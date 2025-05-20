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
MINIO_SECURE=${MINIO_SECURE:-false}

# Redis
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_DB=${REDIS_DB:-1}
REDIS_PASSWORD=${REDIS_PASSWORD:-}
REDIS_VERIFICATION_CODE_EXPIRE=${REDIS_VERIFICATION_CODE_EXPIRE:-300}

# Neo4j
NEO4J_HOST=${NEO4J_HOST:-localhost}
NEO4J_PORT=${NEO4J_PORT:-7687}
NEO4J_HTTP_PORT=${NEO4J_HTTP_PORT:-7474}
NEO4J_USERNAME=${NEO4J_USERNAME:-neo4j} # Default Neo4j user
NEO4J_INITIAL_PASSWORD=${NEO4J_INITIAL_PASSWORD:-neo4j} # Default initial password for the 'neo4j' user
NEO4J_PASSWORD=${NEO4J_PASSWORD:-virtualsite} # Desired new password
NEO4J_VERSION="5.18.0"

# --- 存储路径 ---
INSTALL_BASE_DIR=/opt/dbs_local
DATA_BASE_DIR=/var/lib/dbs_data

echo "--- Running in a non-systemd environment (e.g., Docker) ---"
echo "--- Services will be started manually ---"

echo "--- 正在创建安装和数据目录 ---"
sudo mkdir -p "${INSTALL_BASE_DIR}"
sudo mkdir -p "${DATA_BASE_DIR}"
sudo chown -R "$(whoami)":"$(whoami)" "${INSTALL_BASE_DIR}"

echo ""
echo "--- 正在安装必要工具 (gnupg, curl, wget, psmisc, netcat-traditional) ---"
# Added -qq to apt install for quieter output during successful installs
sudo apt update -qq
sudo apt install -y -qq gnupg curl wget psmisc netcat-traditional
if [ $? -ne 0 ]; then
    echo "错误：apt update 或安装必要工具失败，请检查网络和权限。"
    exit 1
fi

# --- 1. 安装并配置 MongoDB ---
echo ""
echo "--- 1. 正在安装并配置 MongoDB (使用 ${MONGO_VERSION} 版本) ---"
MONGO_REPO_URL="https://repo.mongodb.org/apt/ubuntu"
MONGO_DISTRO="noble"
MONGO_VERSION="8.0"

curl -fsSL https://www.mongodb.org/static/pgp/server-${MONGO_VERSION}.asc | \
   sudo gpg --dearmor -o /usr/share/keyrings/mongodb-archive-keyring.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-archive-keyring.gpg ] ${MONGO_REPO_URL} ${MONGO_DISTRO}/mongodb-org/${MONGO_VERSION} multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-${MONGO_VERSION}.list > /dev/null
sudo apt update -qq
sudo apt install -y -qq mongodb-org || {
    echo "错误：MongoDB APT 安装失败。"
    exit 1
}

sudo killall mongod || true # Allow to fail if no process

sudo mkdir -p "${DATA_BASE_DIR}/mongodb"
sudo chown -R mongodb:mongodb "${DATA_BASE_DIR}/mongodb"

if [ -f "/etc/mongod.conf" ]; then
    sudo mv /etc/mongod.conf /etc/mongod.conf.backup
fi
# Removed storage.journal.enabled as it's default in MongoDB 8.0 and caused errors.
sudo bash -c "cat <<EOF > /etc/mongod.conf
storage:
  dbPath: ${DATA_BASE_DIR}/mongodb
  # journal: # Journaling is enabled by default in MongoDB 8.0
  #   enabled: true 
systemLog:
  destination: file
  logAppend: true
  path: ${DATA_BASE_DIR}/mongodb/mongod.log
processManagement:
  fork: true
net:
  port: ${MONGO_PORT}
  bindIp: 0.0.0.0
security:
  authorization: enabled
EOF"

echo "正在启动 MongoDB..."
nohup sudo mongod --config /etc/mongod.conf > "${DATA_BASE_DIR}/mongodb/mongod_stdout.log" 2>&1 &
echo "等待 MongoDB 启动 (30 秒)... (如果持续失败，请检查 Docker 资源限制和 MongoDB 日志)"
sleep 3 # Reduced sleep slightly, main issue was config.

echo "正在配置 MongoDB 用户和密码..."
MONGO_SHELL_CMD=""
if command -v mongosh &> /dev/null; then
    MONGO_SHELL_CMD="mongosh --port ${MONGO_PORT} --quiet"
elif command -v mongo &> /dev/null; then
    MONGO_SHELL_CMD="mongo --port ${MONGO_PORT} --quiet"
else
    echo "警告：MongoDB shell 未找到。无法自动配置用户。"
fi

if [ -n "$MONGO_SHELL_CMD" ]; then
    COUNT=0
    MAX_RETRIES=3 
    RETRY_INTERVAL=5 
    echo "等待 MongoDB 响应 (最多 ${MAX_RETRIES} 次尝试)..."
    while ! nc -z ${MONGO_HOST} ${MONGO_PORT} &> /dev/null && [ $COUNT -lt ${MAX_RETRIES} ]; do
        echo "  尝试 $((COUNT+1))/${MAX_RETRIES}... (检查端口 ${MONGO_HOST}:${MONGO_PORT})"
        sleep ${RETRY_INTERVAL}
        COUNT=$((COUNT+1))
    done

    if [ $COUNT -lt ${MAX_RETRIES} ]; then
        echo "MongoDB 响应成功。正在配置用户..."
        ${MONGO_SHELL_CMD} <<EOF
use admin
db.createUser({
  user: "${MONGO_USERNAME}",
  pwd: "${MONGO_PASSWORD}",
  roles: [{ role: "root", db: "admin" }]
})
quit()
EOF
        echo "MongoDB 用户 '${MONGO_USERNAME}' 配置尝试完成。"
        echo "请检查 MongoDB 日志 (${DATA_BASE_DIR}/mongodb/mongod.log 和 ${DATA_BASE_DIR}/mongodb/mongod_stdout.log) 确认用户创建成功。"
    else
        echo "错误：MongoDB 未在预期时间内启动或响应。"
        echo "MongoDB 日志内容如下:"
        echo "--- mongod_stdout.log ---"
        sudo cat "${DATA_BASE_DIR}/mongodb/mongod_stdout.log" || echo "  (stdout log not found or unreadable)"
        echo "--- mongod.log ---"
        sudo cat "${DATA_BASE_DIR}/mongodb/mongod.log" || echo "  (log not found or unreadable)"
        echo "-----------------------"
        echo "请尝试手动运行: sudo -u mongodb mongod --config /etc/mongod.conf --auth (或 sudo mongod ...) 并查看输出。"
    fi
else
    echo "无法自动配置 MongoDB 用户，因为 MongoDB shell 未找到。"
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
sudo chown -R "$(whoami)":"$(whoami)" "${MINIO_DATA_DIR}" "${MINIO_CONFIG_DIR}"

echo "正在启动 MinIO..."
export MINIO_ROOT_USER="${MINIO_USERNAME}"
export MINIO_ROOT_PASSWORD="${MINIO_PASSWORD}"
nohup "${MINIO_BIN_PATH}" server "${MINIO_DATA_DIR}" --config-dir "${MINIO_CONFIG_DIR}" \
  --address "0.0.0.0:${MINIO_PORT}" > "${DATA_BASE_DIR}/minio.log" 2>&1 &
echo "等待 MinIO 启动 (10 秒)..."
sleep 3

echo "MinIO 已启动，日志在 ${DATA_BASE_DIR}/minio.log"
echo "MinIO 配置完成。"


# --- 3. 安装并配置 Redis ---
echo ""
echo "--- 3. 正在安装并配置 Redis ---"
sudo apt install -y -qq redis-server

sudo killall redis-server || true

REDIS_CONF_PATH="/etc/redis/redis.conf"
REDIS_DATA_DIR="${DATA_BASE_DIR}/redis_data"
sudo mkdir -p "${REDIS_DATA_DIR}"
sudo chown redis:redis "${REDIS_DATA_DIR}"

if [ -f "${REDIS_CONF_PATH}" ]; then
    sudo mv "${REDIS_CONF_PATH}" "${REDIS_CONF_PATH}.backup"
fi

sudo bash -c "cat <<EOF > ${REDIS_CONF_PATH}
bind 0.0.0.0
port ${REDIS_PORT}
timeout 0
tcp-keepalive 300
daemonize yes
# Default pidfile location
pidfile /var/run/redis/redis-server.pid
logfile \"${DATA_BASE_DIR}/redis.log\"
dir \"${REDIS_DATA_DIR}\"
databases ${REDIS_DB}
$(if [ -n "$REDIS_PASSWORD" ]; then echo "requirepass ${REDIS_PASSWORD}"; fi)
$(if [ -z "$REDIS_PASSWORD" ]; then echo "protected-mode no"; fi)
EOF"

sudo mkdir -p /var/run/redis
sudo chown redis:redis /var/run/redis

echo "正在启动 Redis..."
sudo redis-server "${REDIS_CONF_PATH}"
echo "等待 Redis 启动 (5 秒)..."
sleep 2
echo "Redis 启动完成。"


# --- 4. 安装并配置 Neo4j ---
echo ""
echo "--- 4. 正在安装并配置 Neo4j ${NEO4J_VERSION} ---"
NEO4J_TAR_URL="https://dist.neo4j.org/neo4j-community-${NEO4J_VERSION}-unix.tar.gz"
NEO4J_DOWNLOADED_TAR="${INSTALL_BASE_DIR}/neo4j-community-${NEO4J_VERSION}-unix.tar.gz"
NEO4J_EXTRACT_BASE_DIR="${INSTALL_BASE_DIR}"
NEO4J_FINAL_DIR="${NEO4J_EXTRACT_BASE_DIR}/neo4j-community-${NEO4J_VERSION}"
NEO4J_SYMLINK_DIR="${NEO4J_EXTRACT_BASE_DIR}/neo4j"

echo "正在下载 Neo4j..."
wget -q "${NEO4J_TAR_URL}" -O "${NEO4J_DOWNLOADED_TAR}"
if [ ! -f "${NEO4J_DOWNLOADED_TAR}" ]; then
    echo "错误：Neo4j 下载失败。"
    exit 1
fi

echo "正在解压 Neo4j..."
sudo tar -xzf "${NEO4J_DOWNLOADED_TAR}" -C "${NEO4J_EXTRACT_BASE_DIR}"
if [ ! -d "${NEO4J_FINAL_DIR}" ]; then
    echo "错误：Neo4j 解压后未找到目录 '${NEO4J_FINAL_DIR}'。"
    exit 1
fi
sudo ln -sfn "${NEO4J_FINAL_DIR}" "${NEO4J_SYMLINK_DIR}"
sudo rm "${NEO4J_DOWNLOADED_TAR}"

NEO4J_DATA_DIR_CONF="${DATA_BASE_DIR}/neo4j_data"
NEO4J_LOGS_DIR_CONF="${DATA_BASE_DIR}/neo4j_logs"
sudo mkdir -p "${NEO4J_DATA_DIR_CONF}" "${NEO4J_LOGS_DIR_CONF}"
sudo chown -R "$(whoami)":"$(whoami)" "${NEO4J_DATA_DIR_CONF}" "${NEO4J_LOGS_DIR_CONF}"

NEO4J_CONF_FILE="${NEO4J_SYMLINK_DIR}/conf/neo4j.conf"
echo "正在配置 Neo4j (${NEO4J_CONF_FILE})..."
sudo cp "${NEO4J_CONF_FILE}" "${NEO4J_CONF_FILE}.backup"

NEO4J_DATA_DIR_ESCAPED=$(echo "${NEO4J_DATA_DIR_CONF}" | sed 's/[&/\]/\\&/g')
NEO4J_LOGS_DIR_ESCAPED=$(echo "${NEO4J_LOGS_DIR_CONF}" | sed 's/[&/\]/\\&/g')

sudo sed -i "s|^#*\(server\.default_listen_address\s*=\s*\).*|\10.0.0.0|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|^#*\(server\.bolt\.listen_address\s*=\s*\).*|\1:${NEO4J_PORT}|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|^#*\(server\.http\.listen_address\s*=\s*\).*|\1:${NEO4J_HTTP_PORT}|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|^#*\(server\.directories\.data\s*=\s*\).*|\1${NEO4J_DATA_DIR_ESCAPED}|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|^#*\(server\.directories\.logs\s*=\s*\).*|\1${NEO4J_LOGS_DIR_ESCAPED}|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|^#*\(dbms\.security\.auth_enabled\s*=\s*\)false|\1true|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|^#\(dbms\.security\.auth_enabled\s*=\s*true\)|\1|g" "${NEO4J_CONF_FILE}"

echo "正在启动 Neo4j..."
"${NEO4J_SYMLINK_DIR}/bin/neo4j" start
echo "等待 Neo4j 启动并初始化 (30 秒)..."
sleep 5

echo "正在修改 Neo4j 默认密码..."
NEO4J_CYPHER_SHELL="${NEO4J_SYMLINK_DIR}/bin/cypher-shell"
if [ -f "${NEO4J_CYPHER_SHELL}" ]; then
    echo "等待 Neo4j Bolt 端口 ${NEO4J_PORT} 可用..."
    COUNT=0
    MAX_RETRIES_NEO4J=20
    RETRY_INTERVAL_NEO4J=3
    while ! nc -z "${NEO4J_HOST}" "${NEO4J_PORT}" &> /dev/null && [ $COUNT -lt ${MAX_RETRIES_NEO4J} ]; do
        echo "  尝试连接 Neo4j Bolt 端口... ($((COUNT+1))/${MAX_RETRIES_NEO4J})"
        sleep ${RETRY_INTERVAL_NEO4J}
        COUNT=$((COUNT+1))
    done

    if [ $COUNT -lt ${MAX_RETRIES_NEO4J} ]; then
        echo "Neo4j Bolt 端口可用。正在尝试修改密码..."
        echo "ALTER CURRENT USER SET PASSWORD FROM '${NEO4J_INITIAL_PASSWORD}' TO '${NEO4J_PASSWORD}'" | \
        "${NEO4J_CYPHER_SHELL}" -u "${NEO4J_USERNAME}" -p "${NEO4J_INITIAL_PASSWORD}" \
        --address "${NEO4J_HOST}:${NEO4J_PORT}" --format plain --database system
        
        if [ $? -eq 0 ]; then
            echo "Neo4j 密码修改命令已成功发送。用户 '${NEO4J_USERNAME}' 新密码为 '${NEO4J_PASSWORD}'。"
        else
            echo "警告：cypher-shell 自动修改密码失败 (退出码 $?)。"
            echo "请检查 Neo4j 日志: ${NEO4J_LOGS_DIR_CONF}/neo4j.log"
            echo "您可能需要手动更改 Neo4j 密码。初始用户名: ${NEO4J_USERNAME}, 初始密码: ${NEO4J_INITIAL_PASSWORD}"
            echo "命令: ALTER CURRENT USER SET PASSWORD FROM '${NEO4J_INITIAL_PASSWORD}' TO '${NEO4J_PASSWORD}';"
            echo "  (在 cypher-shell 中执行，连接时使用初始密码，并指定 --database system)"
        fi
    else
        echo "错误：Neo4j Bolt 端口 (${NEO4J_HOST}:${NEO4J_PORT}) 未在预期时间内开放。"
        echo "请检查 Neo4j 服务状态 (${NEO4J_SYMLINK_DIR}/bin/neo4j status) 和日志: ${NEO4J_LOGS_DIR_CONF}/neo4j.log"
    fi
else
    echo "警告：cypher-shell 未找到 (${NEO4J_CYPHER_SHELL})。无法自动更改 Neo4j 密码。"
fi
echo "Neo4j 配置和密码修改尝试完成。"


# --- 总结 ---
echo ""
echo "--- 所有数据库安装和配置脚本已运行完成 ---"
echo "请注意：这些数据库在容器内运行，数据存储在 ${DATA_BASE_DIR}。"
echo "若要在容器重启后保留数据，请确保 ${DATA_BASE_DIR} 已正确挂载到宿主机卷。"
echo "以下是连接信息："
echo "--------------------------------------------------"
echo "MongoDB:"
echo "  Host: ${MONGO_HOST}"
echo "  Port: ${MONGO_PORT}"
echo "  Username: ${MONGO_USERNAME}"
echo "  Password: ${MONGO_PASSWORD}"
echo "  Database: ${MONGO_DB_NAME} (或连接到 admin db 进行认证)"
echo "  Log: ${DATA_BASE_DIR}/mongodb/mongod.log, ${DATA_BASE_DIR}/mongodb/mongod_stdout.log"
echo "--------------------------------------------------"
echo "MinIO:"
echo "  Host: ${MINIO_HOST}"
echo "  Port: ${MINIO_PORT}"
echo "  Access Key: ${MINIO_USERNAME}"
echo "  Secret Key: ${MINIO_PASSWORD}"
echo "  API Endpoint: http://${MINIO_HOST}:${MINIO_PORT}"
echo "  Console: 通常与 API Endpoint 相同，或查阅 MinIO 文档/日志。"
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
echo "  Password: ${NEO4J_PASSWORD} (如果密码修改成功)"
echo "  Initial Password (if needed for manual change): ${NEO4J_INITIAL_PASSWORD}"
echo "  Data Dir: ${NEO4J_DATA_DIR_CONF}"
echo "  Logs Dir: ${NEO4J_LOGS_DIR_CONF}/neo4j.log"
echo "--------------------------------------------------"

echo ""
echo "请手动检查各个服务的状态和日志，确保它们已成功启动并配置正确。"
echo "  MongoDB: ps aux | grep mongod; echo '--- stdout log ---'; tail -n 30 ${DATA_BASE_DIR}/mongodb/mongod_stdout.log; echo '--- main log ---'; tail -n 30 ${DATA_BASE_DIR}/mongodb/mongod.log"
echo "  MinIO: ps aux | grep minio; tail -n 20 ${DATA_BASE_DIR}/minio.log"
# Corrected Redis ping command for summary
REDIS_PING_CMD="redis-cli -p ${REDIS_PORT}"
if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_PING_CMD="${REDIS_PING_CMD} -a \"${REDIS_PASSWORD}\""
fi
REDIS_PING_CMD="${REDIS_PING_CMD} ping"

echo "  Redis: ps aux | grep redis-server; tail -n 20 ${DATA_BASE_DIR}/redis.log; ${REDIS_PING_CMD}"
echo "  Neo4j: ${NEO4J_SYMLINK_DIR}/bin/neo4j status; tail -n 30 ${NEO4J_LOGS_DIR_CONF}/neo4j.log"
echo ""
echo "脚本执行完毕。"

