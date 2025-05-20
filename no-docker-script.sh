#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

# --- 数据库配置变量 ---
# MongoDB
MONGO_USERNAME=${MONGO_USERNAME:-admin}
MONGO_PASSWORD=${MONGO_PASSWORD:-admin123}
MONGO_HOST=${MONGO_HOST:-localhost}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_DB_NAME=${MONGO_DB_NAME:-virtualsite}

# MinIO
MINIO_USERNAME=${MINIO_USERNAME:-minioadmin}
MINIO_PASSWORD=${MINIO_PASSWORD:-minioadmin}
MINIO_HOST=${MINIO_HOST:-localhost}
MINIO_PORT=${MINIO_PORT:-9000}
MINIO_SECURE=${MINIO_SECURE:-false} # MinIO console port will be MINIO_PORT + 1 (9001)

# Redis
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_DB=${REDIS_DB:-1}
REDIS_PASSWORD=${REDIS_PASSWORD:-} # 默认无密码
REDIS_VERIFICATION_CODE_EXPIRE=${REDIS_VERIFICATION_CODE_EXPIRE:-300}

# Neo4j
NEO4J_HOST=${NEO4J_HOST:-localhost} # Added for consistency, used in nc check
NEO4J_PORT=${NEO4J_PORT:-7687}
NEO4J_HTTP_PORT=${NEO4J_HTTP_PORT:-7474}
NEO4J_USERNAME=${NEO4J_USERNAME:-neo4j}
NEO4J_PASSWORD=${NEO4J_PASSWORD:-virtualsite}
NEO4J_VERSION="5.18.0" # 你可以根据需要调整版本

# --- 存储路径 (所有数据将存储在此目录，非持久化，除非容器外部有挂载) ---
INSTALL_BASE_DIR=/opt/dbs_local
DATA_BASE_DIR=/var/lib/dbs_data # 默认数据目录，如果需要持久化请修改此行

echo "--- 正在创建安装和数据目录 ---"
sudo mkdir -p "${INSTALL_BASE_DIR}"
sudo mkdir -p "${DATA_BASE_DIR}"
# 确保当前用户对安装目录有写权限
sudo chown -R "$(whoami)":"$(whoami)" "${INSTALL_BASE_DIR}"
# Data base directory permissions will be set per service

# --- 安装必要的工具 ---
echo ""
echo "--- 正在安装必要工具 (gnupg, curl, wget, psmisc, netcat-traditional) ---"
sudo apt update
sudo apt install -y gnupg curl wget psmisc netcat-traditional
if [ $? -ne 0 ]; then
    echo "错误：apt update 或安装必要工具失败，请检查网络和权限。"
    exit 1
fi

# --- 1. 安装并配置 MongoDB ---
echo ""
echo "--- 1. 正在安装并配置 MongoDB (使用 8.0 版本) ---"
MONGO_REPO_URL="https://repo.mongodb.org/apt/ubuntu"
MONGO_DISTRO="noble" # Ubuntu 24.04 的代号
MONGO_VERSION="8.0" # 使用 MongoDB 8.0

# 导入 MongoDB 公钥
curl -fsSL https://www.mongodb.org/static/pgp/server-${MONGO_VERSION}.asc | \
   sudo gpg --dearmor -o /usr/share/keyrings/mongodb-archive-keyring.gpg

# 为 MongoDB 创建列表文件
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-archive-keyring.gpg ] ${MONGO_REPO_URL} ${MONGO_DISTRO}/mongodb-org/${MONGO_VERSION} multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-${MONGO_VERSION}.list > /dev/null

# 更新 apt 并安装 MongoDB
sudo apt update
sudo apt install -y mongodb-org || {
    echo "错误：MongoDB APT 安装失败。请检查 MongoDB 仓库配置是否正确，或者网络/权限问题。"
    echo "如果问题持续存在，可能需要手动下载 MongoDB 二进制文件安装。"
    exit 1
}

# 停止可能由 apt 自动启动的服务 (使用 killall，因为 service/systemctl 不可用)
sudo killall mongod || true # Allow command to fail if no process is found

# 创建 MongoDB 数据目录并设置权限
sudo mkdir -p "${DATA_BASE_DIR}/mongodb"
sudo chown -R mongodb:mongodb "${DATA_BASE_DIR}/mongodb" # mongodb user is created by package installer

# 备份原始配置文件并创建自定义配置文件
if [ -f "/etc/mongod.conf" ]; then
    sudo mv /etc/mongod.conf /etc/mongod.conf.backup
fi
sudo bash -c "cat <<EOF > /etc/mongod.conf
# mongod.conf
storage:
  dbPath: ${DATA_BASE_DIR}/mongodb
  journal:
    enabled: true
systemLog:
  destination: file
  logAppend: true
  path: ${DATA_BASE_DIR}/mongodb/mongod.log
processManagement:
  fork: true # 启动为后台进程
net:
  port: ${MONGO_PORT}
  bindIp: 0.0.0.0 # 允许所有 IP 连接
security:
  authorization: enabled # 启用认证
EOF"

# 启动 MongoDB 守护进程 (使用 nohup 绕过 systemd)
echo "正在启动 MongoDB..."
nohup sudo mongod --config /etc/mongod.conf > "${DATA_BASE_DIR}/mongodb/mongod_stdout.log" 2>&1 &
echo "等待 MongoDB 启动 (20 秒)..."
sleep 20 # 增加等待时间，确保 MongoDB 完全启动

# 配置 MongoDB 用户和密码
echo "正在配置 MongoDB 用户和密码..."
MONGO_SHELL_CMD=""
if command -v mongosh &> /dev/null; then
    MONGO_SHELL_CMD="mongosh --port ${MONGO_PORT} --quiet"
elif command -v mongo &> /dev/null; then
    MONGO_SHELL_CMD="mongo --port ${MONGO_PORT} --quiet"
else
    echo "警告：MongoDB shell (mongosh 或 mongo) 未找到。无法自动配置用户。请手动配置。"
fi

if [ -n "$MONGO_SHELL_CMD" ]; then
    # 等待 MongoDB 接受连接
    COUNT=0
    MAX_RETRIES=20 # Increased retries
    RETRY_INTERVAL=3 # Increased interval
    echo "等待 MongoDB 响应..."
    while ! nc -z ${MONGO_HOST} ${MONGO_PORT} &> /dev/null && [ $COUNT -lt ${MAX_RETRIES} ]; do
        echo "  尝试 ${COUNT}/${MAX_RETRIES}..."
        sleep ${RETRY_INTERVAL}
        COUNT=$((COUNT+1))
    done

    if [ $COUNT -lt ${MAX_RETRIES} ]; then
        echo "MongoDB 响应成功。正在配置用户..."
        # Corrected role definition: 'role' instead of 'rorole'
        ${MONGO_SHELL_CMD} <<EOF
use admin
db.createUser({
  user: "${MONGO_USERNAME}",
  pwd: "${MONGO_PASSWORD}",
  roles: [{ role: "root", db: "admin" }]
})
quit()
EOF
        # Check user creation (basic check, assumes createUser doesn't throw error on success)
        # A more robust check would involve trying to authenticate.
        echo "MongoDB 用户 '${MONGO_USERNAME}' 配置尝试完成。"
        echo "请检查 MongoDB 日志 (${DATA_BASE_DIR}/mongodb/mongod.log 和 ${DATA_BASE_DIR}/mongodb/mongod_stdout.log) 确认用户创建成功。"
    else
        echo "错误：MongoDB 未在预期时间内启动或响应。请手动检查并配置用户。"
        echo "MongoDB 日志: ${DATA_BASE_DIR}/mongodb/mongod.log, ${DATA_BASE_DIR}/mongodb/mongod_stdout.log"
    fi
else
    echo "无法自动配置 MongoDB 用户，因为没有找到 MongoDB shell。"
fi


# --- 2. 安装并配置 MinIO ---
echo ""
echo "--- 2. 正在安装并配置 MinIO ---"
MINIO_BIN_PATH="${INSTALL_BASE_DIR}/minio"
MINIO_DATA_DIR="${DATA_BASE_DIR}/minio_data"
MINIO_CONFIG_DIR="${DATA_BASE_DIR}/minio_config"

wget -q https://dl.min.io/server/minio/release/linux-amd64/minio -O "${MINIO_BIN_PATH}"
chmod +x "${MINIO_BIN_PATH}"

sudo mkdir -p "${MINIO_DATA_DIR}" "${MINIO_CONFIG_DIR}"
# MinIO runs as the user who starts it. Set permissions for current user.
sudo chown -R "$(whoami)":"$(whoami)" "${MINIO_DATA_DIR}" "${MINIO_CONFIG_DIR}"

echo "正在启动 MinIO..."
# 设置环境变量并启动 MinIO (使用 nohup)
export MINIO_ROOT_USER="${MINIO_USERNAME}"
export MINIO_ROOT_PASSWORD="${MINIO_PASSWORD}"
nohup "${MINIO_BIN_PATH}" server "${MINIO_DATA_DIR}" --config-dir "${MINIO_CONFIG_DIR}" \
  --address "0.0.0.0:${MINIO_PORT}" > "${DATA_BASE_DIR}/minio.log" 2>&1 &
echo "等待 MinIO 启动 (10 秒)..."
sleep 10 # 等待 MinIO 启动

echo "MinIO 已启动，日志在 ${DATA_BASE_DIR}/minio.log"
echo "MinIO 配置完成。请使用以下凭据访问："
echo "  访问密钥 (Access Key): ${MINIO_USERNAME}"
echo "  秘密密钥 (Secret Key): ${MINIO_PASSWORD}"
echo "  MinIO API Endpoint: http://${MINIO_HOST}:${MINIO_PORT}"
echo "  MinIO Console: 通常是 API Endpoint，或者特定 console 地址，请查阅 MinIO 文档或启动日志。"


# --- 3. 安装并配置 Redis ---
echo ""
echo "--- 3. 正在安装并配置 Redis ---"
sudo apt install -y redis-server

# 停止可能由 apt 自动启动的服务 (使用 killall)
sudo killall redis-server || true # Allow command to fail if no process is found

# 备份原始配置文件并创建自定义配置文件
REDIS_CONF_PATH="/etc/redis/redis.conf"
REDIS_DATA_DIR="${DATA_BASE_DIR}/redis_data" # Define Redis data directory
sudo mkdir -p "${REDIS_DATA_DIR}"
sudo chown redis:redis "${REDIS_DATA_DIR}" # Redis runs as 'redis' user

if [ -f "${REDIS_CONF_PATH}" ]; then
    sudo mv "${REDIS_CONF_PATH}" "${REDIS_CONF_PATH}.backup"
fi

sudo bash -c "cat <<EOF > ${REDIS_CONF_PATH}
bind 0.0.0.0
port ${REDIS_PORT}
timeout 0
tcp-keepalive 300
daemonize yes
pidfile /var/run/redis/redis-server.pid # Default pidfile location
logfile \"${DATA_BASE_DIR}/redis.log\"
dir \"${REDIS_DATA_DIR}\" # Set Redis data directory
databases ${REDIS_DB}
$(if [ -n "$REDIS_PASSWORD" ]; then echo "requirepass ${REDIS_PASSWORD}"; fi)
# Ensure protected-mode is off if binding to 0.0.0.0 without a password
$(if [ -z "$REDIS_PASSWORD" ]; then echo "protected-mode no"; fi)
EOF"

# Ensure Redis run directory exists and has correct permissions
sudo mkdir -p /var/run/redis
sudo chown redis:redis /var/run/redis

# 启动 Redis 服务 (直接执行二进制文件，因为 daemonize yes 会使其后台运行)
echo "正在启动 Redis..."
sudo redis-server "${REDIS_CONF_PATH}"
echo "等待 Redis 启动 (5 秒)..."
sleep 5 # 等待 Redis 启动
echo "Redis 启动完成。"


# --- 4. 安装并配置 Neo4j ---
echo ""
echo "--- 4. 正在安装并配置 Neo4j ${NEO4J_VERSION} ---"
NEO4J_TAR_URL="https://dist.neo4j.org/neo4j-community-${NEO4J_VERSION}-unix.tar.gz" # Official dist URL
NEO4J_DOWNLOADED_TAR="${INSTALL_BASE_DIR}/neo4j-community-${NEO4J_VERSION}-unix.tar.gz"
NEO4J_EXTRACT_BASE_DIR="${INSTALL_BASE_DIR}"
NEO4J_FINAL_DIR="${NEO4J_EXTRACT_BASE_DIR}/neo4j-community-${NEO4J_VERSION}" # Standard extracted name
NEO4J_SYMLINK_DIR="${NEO4J_EXTRACT_BASE_DIR}/neo4j" # Simpler symlink

echo "正在下载 Neo4j..."
wget -q "${NEO4J_TAR_URL}" -O "${NEO4J_DOWNLOADED_TAR}"

# 检查下载是否成功
if [ ! -f "${NEO4J_DOWNLOADED_TAR}" ]; then
    echo "错误：Neo4j 下载失败。请检查 URL 或网络连接。"
    exit 1
fi

echo "正在解压 Neo4j..."
sudo tar -xzf "${NEO4J_DOWNLOADED_TAR}" -C "${NEO4J_EXTRACT_BASE_DIR}"

# 检查解压后目录是否存在
if [ ! -d "${NEO4J_FINAL_DIR}" ]; then
    echo "错误：Neo4j 解压后未找到目录 '${NEO4J_FINAL_DIR}'。"
    exit 1
fi

# Create a symlink for easier access (optional)
sudo ln -sfn "${NEO4J_FINAL_DIR}" "${NEO4J_SYMLINK_DIR}"

sudo rm "${NEO4J_DOWNLOADED_TAR}" # 清理安装包

# Neo4j 数据和日志目录
NEO4J_DATA_DIR_CONF="${DATA_BASE_DIR}/neo4j_data" # Path for config file
NEO4J_LOGS_DIR_CONF="${DATA_BASE_DIR}/neo4j_logs" # Path for config file
sudo mkdir -p "${NEO4J_DATA_DIR_CONF}" "${NEO4J_LOGS_DIR_CONF}"
# Neo4j from tarball runs as the user who starts it.
sudo chown -R "$(whoami)":"$(whoami)" "${NEO4J_DATA_DIR_CONF}" "${NEO4J_LOGS_DIR_CONF}"

# 修改 Neo4j 配置
NEO4J_CONF_FILE="${NEO4J_SYMLINK_DIR}/conf/neo4j.conf"
echo "正在配置 Neo4j (${NEO4J_CONF_FILE})..."
# 备份原始文件
sudo cp "${NEO4J_CONF_FILE}" "${NEO4J_CONF_FILE}.backup"

# Escape paths for sed
NEO4J_DATA_DIR_ESCAPED=$(echo "${NEO4J_DATA_DIR_CONF}" | sed 's/[&/\]/\\&/g')
NEO4J_LOGS_DIR_ESCAPED=$(echo "${NEO4J_LOGS_DIR_CONF}" | sed 's/[&/\]/\\&/g')

# Use server.* settings for Neo4j 5.x
sudo sed -i "s|^#*\(server\.default_listen_address\s*=\s*\).*|\10.0.0.0|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|^#*\(server\.bolt\.listen_address\s*=\s*\).*|\1:${NEO4J_PORT}|g" "${NEO4J_CONF_FILE}" # Port only, address from default_listen_address
sudo sed -i "s|^#*\(server\.http\.listen_address\s*=\s*\).*|\1:${NEO4J_HTTP_PORT}|g" "${NEO4J_CONF_FILE}" # Port only

# Correctly set data and logs directories using server.directories.*
sudo sed -i "s|^#*\(server\.directories\.data\s*=\s*\).*|\1${NEO4J_DATA_DIR_ESCAPED}|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|^#*\(server\.directories\.logs\s*=\s*\).*|\1${NEO4J_LOGS_DIR_ESCAPED}|g" "${NEO4J_CONF_FILE}"

# Ensure auth is enabled (dbms.security.auth_enabled is correct for Neo4j 5.x)
# Neo4j 5 defaults to auth enabled (dbms.security.auth_enabled=true).
# This line ensures it's not explicitly set to false.
sudo sed -i "s|^#*\(dbms\.security\.auth_enabled\s*=\s*\)false|\1true|g" "${NEO4J_CONF_FILE}"
# If the line #dbms.security.auth_enabled=true exists, uncomment it.
sudo sed -i "s|^#\(dbms\.security\.auth_enabled\s*=\s*true\)|\1|g" "${NEO4J_CONF_FILE}"
# If it doesn't exist and isn't set to false, it will default to true.

# Disable initial password reset requirement by setting a known password (optional, but helps automation)
# sudo sed -i "s|^#*\(initial\.default_password\s*=\s*\).*|\1${NEO4J_PASSWORD}|g" "${NEO4J_CONF_FILE}"
# The above might not work as intended; password change via cypher-shell is more reliable.

# Start Neo4j service
echo "正在启动 Neo4j..."
"${NEO4J_SYMLINK_DIR}/bin/neo4j" start
echo "等待 Neo4j 启动并初始化 (30 秒)..."
sleep 30 # Increased wait time for Neo4j

# 修改 Neo4j 默认密码
echo "正在修改 Neo4j 默认密码..."
NEO4J_CYPHER_SHELL="${NEO4J_SYMLINK_DIR}/bin/cypher-shell"

if [ -f "${NEO4J_CYPHER_SHELL}" ]; then
    echo "等待 Neo4j Bolt 端口 ${NEO4J_PORT} 可用..."
    COUNT=0
    MAX_RETRIES_NEO4J=20 # Retries for Neo4j port check
    RETRY_INTERVAL_NEO4J=3
    while ! nc -z "${NEO4J_HOST}" "${NEO4J_PORT}" &> /dev/null && [ $COUNT -lt ${MAX_RETRIES_NEO4J} ]; do
        echo "  尝试连接 Neo4j Bolt 端口... (${COUNT}/${MAX_RETRIES_NEO4J})"
        sleep ${RETRY_INTERVAL_NEO4J}
        COUNT=$((COUNT+1))
    done

    if [ $COUNT -lt ${MAX_RETRIES_NEO4J} ]; then
        echo "Neo4j Bolt 端口可用。正在尝试修改密码..."
        # Neo4j 5.x requires changing the password on first connect if not preset.
        # Default user/pass is neo4j/neo4j.
        # The command changes the password for the user 'neo4j'.
        echo "CALL dbms.security.changeUserPassword('${NEO4J_USERNAME}', '${NEO4J_PASSWORD}', '${NEO4J_PASSWORD}')" | \
        "${NEO4J_CYPHER_SHELL}" -u "${NEO4J_USERNAME}" -p "${NEO4J_USERNAME}" \
        --address "${NEO4J_HOST}:${NEO4J_PORT}" --format plain --database neo4j
        
        # Alternative if the above fails due to 'current user' context.
        # This command directly alters the 'neo4j' user's password.
        # echo "ALTER USER ${NEO4J_USERNAME} SET PASSWORD '${NEO4J_PASSWORD}'" | \
        # "${NEO4J_CYPHER_SHELL}" -u "${NEO4J_USERNAME}" -p "${NEO4J_USERNAME}" \
        # --address "${NEO4J_HOST}:${NEO4J_PORT}" --format plain --database neo4j
        
        # After password change, the old password 'neo4j' is no longer valid.
        # Subsequent connections should use the new password.
        # For this script, we assume the change was successful.
        # A verification step could be added here.

        if [ $? -eq 0 ]; then
            echo "Neo4j 密码修改命令已发送。新密码为 '${NEO4J_PASSWORD}'。"
        else
            echo "警告：cypher-shell 自动修改密码可能失败 (退出码 $?)。"
            echo "请检查 Neo4j 日志: ${NEO4J_LOGS_DIR_CONF}"
            echo "您可能需要手动更改 Neo4j 密码 '${NEO4J_USERNAME}'。"
            echo "尝试运行: ${NEO4J_CYPHER_SHELL} -u ${NEO4J_USERNAME} -p <current_password> --address ${NEO4J_HOST}:${NEO4J_PORT}"
            echo "然后执行: ALTER USER ${NEO4J_USERNAME} SET PASSWORD '${NEO4J_PASSWORD}';"
        fi
    else
        echo "错误：Neo4j Bolt 端口 (${NEO4J_HOST}:${NEO4J_PORT}) 未在预期时间内开放。"
        echo "请检查 Neo4j 服务状态和日志: ${NEO4J_LOGS_DIR_CONF}"
        echo "  ${NEO4J_SYMLINK_DIR}/bin/neo4j status"
    fi
else
    echo "警告：cypher-shell 未找到 (${NEO4J_CYPHER_SHELL})。无法自动更改 Neo4j 密码。"
fi
echo "Neo4j 配置和密码修改尝试完成。"


# --- 总结 ---
echo ""
echo "--- 所有数据库安装和配置脚本已运行完成 ---"
echo "请注意：这些数据库将在容器内运行，但数据是非持久化的，除非容器启动时有挂载外部卷到 ${DATA_BASE_DIR}。"
echo "以下是连接信息："
echo "--------------------------------------------------"
echo "MongoDB:"
echo "  Host: ${MONGO_HOST}"
echo "  Port: ${MONGO_PORT}"
echo "  Username: ${MONGO_USERNAME}"
echo "  Password: ${MONGO_PASSWORD}"
echo "  Database: ${MONGO_DB_NAME} (or connect to admin db first)"
echo "  Log: ${DATA_BASE_DIR}/mongodb/mongod.log, ${DATA_BASE_DIR}/mongodb/mongod_stdout.log"
echo "--------------------------------------------------"
echo "MinIO:"
echo "  Host: ${MINIO_HOST}"
echo "  Port: ${MINIO_PORT}"
echo "  Access Key: ${MINIO_USERNAME}"
echo "  Secret Key: ${MINIO_PASSWORD}"
echo "  API Endpoint: http://${MINIO_HOST}:${MINIO_PORT}"
echo "  Log: ${DATA_BASE_DIR}/minio.log"
echo "--------------------------------------------------"
echo "Redis:"
echo "  Host: ${REDIS_HOST}"
echo "  Port: ${REDIS_PORT}"
echo "  Database: ${REDIS_DB}"
if [ -n "$REDIS_PASSWORD" ]; then
    echo "  Password: ${REDIS_PASSWORD}"
else
    echo "  Password: (无)"
fi
echo "  Log: ${DATA_BASE_DIR}/redis.log"
echo "  Data Dir: ${REDIS_DATA_DIR}"
echo "--------------------------------------------------"
echo "Neo4j:"
echo "  Host: ${NEO4J_HOST}"
echo "  Bolt Port: ${NEO4J_PORT}"
echo "  HTTP Port: ${NEO4J_HTTP_PORT} (Browser: http://${NEO4J_HOST}:${NEO4J_HTTP_PORT})"
echo "  Username: ${NEO4J_USERNAME}"
echo "  Password: ${NEO4J_PASSWORD} (if change was successful)"
echo "  Data Dir: ${NEO4J_DATA_DIR_CONF}"
echo "  Logs Dir: ${NEO4J_LOGS_DIR_CONF}"
echo "--------------------------------------------------"

echo ""
echo "请手动检查各个服务的状态和日志，确保它们已成功启动并配置正确。"
echo "  MongoDB: ps aux | grep mongod; tail -n 20 ${DATA_BASE_DIR}/mongodb/mongod.log"
echo "  MinIO: ps aux | grep minio; tail -n 20 ${DATA_BASE_DIR}/minio.log"
echo "  Redis: ps aux | grep redis-server; tail -n 20 ${DATA_BASE_DIR}/redis.log"
echo "  Neo4j: ${NEO4J_SYMLINK_DIR}/bin/neo4j status; tail -n 20 ${NEO4J_LOGS_DIR_CONF}/neo4j.log"
echo ""
echo "脚本执行完毕。"

