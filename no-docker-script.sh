#!/bin/bash

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
REDIS_DB=${REDIS_DB:-1} # 修正：Redis 数据库数量至少为 1
REDIS_PASSWORD=${REDIS_PASSWORD:-} # 默认无密码
REDIS_VERIFICATION_CODE_EXPIRE=${REDIS_VERIFICATION_CODE_EXPIRE:-300}

# Neo4j
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
sudo chown -R "$(whoami)":"$(whoami)" "${INSTALL_BASE_DIR}" "${DATA_BASE_DIR}"

# --- 安装必要的工具 ---
echo ""
echo "--- 正在安装必要工具 (gnupg, curl, wget, psmisc) ---"
sudo apt update
sudo apt install -y gnupg curl wget psmisc # 添加 psmisc
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
sudo killall mongod || true

# 创建 MongoDB 数据目录并设置权限
sudo mkdir -p "${DATA_BASE_DIR}/mongodb"
sudo chown -R mongodb:mongodb "${DATA_BASE_DIR}/mongodb" || \
sudo chown -R "$(whoami)":"$(whoami)" "${DATA_BASE_DIR}/mongodb" # 备用权限设置

# 备份原始配置文件并创建自定义配置文件
if [ -f "/etc/mongod.conf" ]; then
    sudo mv /etc/mongod.conf /etc/mongod.conf.backup
fi
sudo bash -c "cat <<EOF > /etc/mongod.conf
# mongod.conf

# for documentation of all options, see:
#   http://docs.mongodb.org/manual/reference/configuration-options/

# Where and how to store data.
storage:
  dbPath: ${DATA_BASE_DIR}/mongodb
  # journal: # journaling is enabled by default and this option is deprecated in recent versions
  #   enabled: true 

# Where to write logging data.
systemLog:
  destination: file
  logAppend: true
  path: ${DATA_BASE_DIR}/mongodb/mongod.log

# Process management
processManagement:
  fork: true # 启动为后台进程

# Network interfaces
net:
  port: ${MONGO_PORT}
  bindIp: 0.0.0.0 # 允许所有 IP 连接

# Security
security:
  authorization: enabled # 启用认证

# Operation Profiling
#operationProfiling:

# Replication
#replication:

# Sharding
#sharding:

## Enterprise-Only Options:

#Auditlog:

#snmp:
EOF"

# 启动 MongoDB 守护进程 (使用 nohup 绕过 systemd)
echo "正在启动 MongoDB..."
nohup sudo mongod --config /etc/mongod.conf > "${DATA_BASE_DIR}/mongodb/mongod_stdout.log" 2>&1 &
sleep 5 # 等待 MongoDB 启动
echo "MongoDB 启动完成。"

# 配置 MongoDB 用户和密码
echo "正在配置 MongoDB 用户和密码..."
# 确保 mongosh 或 mongo shell 已安装
if command -v mongosh &> /dev/null; then
    MONGO_SHELL_CMD="mongosh --port ${MONGO_PORT}"
elif command -v mongo &> /dev/null; then
    MONGO_SHELL_CMD="mongo --port ${MONGO_PORT}"
else
    echo "警告：MongoDB shell (mongosh 或 mongo) 未找到。无法自动配置用户。请手动配置。"
    MONGO_SHELL_CMD=""
fi

if [ -n "$MONGO_SHELL_CMD" ]; then
    # 等待 MongoDB 接受连接
    COUNT=0
    while ! ${MONGO_SHELL_CMD} --eval "db.adminCommand({ ping: 1 })" &> /dev/null && [ $COUNT -lt 15 ]; do # 增加等待时间
        echo "等待 MongoDB 响应... (尝试 ${COUNT}/15)"
        sleep 2
        COUNT=$((COUNT+1))
    done

    if [ $COUNT -lt 15 ]; then
        ${MONGO_SHELL_CMD} <<EOF
use admin
db.createUser({
  user: "${MONGO_USERNAME}",
  pwd: "${MONGO_PASSWORD}",
  roles: [{ role: "root", db: "admin" }]
})
EOF
        echo "MongoDB 用户 '${MONGO_USERNAME}' 配置完成。"
    else
        echo "错误：MongoDB 未在预期时间内启动或响应。请手动检查并配置用户。"
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
sudo chown -R "$(whoami)":"$(whoami)" "${MINIO_DATA_DIR}" "${MINIO_CONFIG_DIR}"

echo "正在启动 MinIO..."
# 设置环境变量并启动 MinIO (使用 nohup)
export MINIO_ROOT_USER="${MINIO_USERNAME}"
export MINIO_ROOT_PASSWORD="${MINIO_PASSWORD}"
nohup "${MINIO_BIN_PATH}" server "${MINIO_DATA_DIR}" --config-dir "${MINIO_CONFIG_DIR}" \
  --address "0.0.0.0:${MINIO_PORT}" > "${DATA_BASE_DIR}/minio.log" 2>&1 &
echo "MinIO 已启动，日志在 ${DATA_BASE_DIR}/minio.log"
sleep 5 # 等待 MinIO 启动

echo "MinIO 配置完成。请使用以下凭据访问："
echo "  访问密钥 (Access Key): ${MINIO_USERNAME}"
echo "  秘密密钥 (Secret Key): ${MINIO_PASSWORD}"
echo "  MinIO Console (HTTP): http://${MINIO_HOST}:${MINIO_PORT}"


# --- 3. 安装并配置 Redis ---
echo ""
echo "--- 3. 正在安装并配置 Redis ---"
sudo apt install -y redis-server

# 停止可能由 apt 自动启动的服务 (使用 killall)
sudo killall redis-server || true

# 备份原始配置文件并创建自定义配置文件
REDIS_CONF_PATH="/etc/redis/redis.conf"
if [ -f "${REDIS_CONF_PATH}" ]; then
    sudo mv "${REDIS_CONF_PATH}" "${REDIS_CONF_PATH}.backup"
fi
sudo bash -c "cat <<EOF > ${REDIS_CONF_PATH}
bind 0.0.0.0
port ${REDIS_PORT}
timeout 0
tcp-keepalive 300
daemonize yes # 作为后台进程运行
pidfile /var/run/redis-server.pid
logfile \"${DATA_BASE_DIR}/redis.log\"
databases ${REDIS_DB}
$(if [ -n "$REDIS_PASSWORD" ]; then echo "requirepass ${REDIS_PASSWORD}"; fi)
# 其他默认配置保持不变
EOF"

# 启动 Redis 服务 (直接执行二进制文件，因为 daemonize yes 会使其后台运行)
echo "正在启动 Redis..."
sudo redis-server "${REDIS_CONF_PATH}"
sleep 3 # 等待 Redis 启动
echo "Redis 启动完成。"


# --- 4. 安装并配置 Neo4j ---
echo ""
echo "--- 4. 正在安装并配置 Neo4j ---"
NEO4J_TAR_URL="https://neo4j.com/artifact.php?name=neo4j-community-${NEO4J_VERSION}-unix.tar.gz"
NEO4J_DOWNLOADED_TAR="${INSTALL_BASE_DIR}/neo4j-community-${NEO4J_VERSION}-unix.tar.gz"
NEO4J_EXTRACT_BASE_DIR="${INSTALL_BASE_DIR}" # 解压到这里
NEO4J_FINAL_DIR="${NEO4J_EXTRACT_BASE_DIR}/neo4j" # 最终简化后的目录名
NEO4J_EXTRACTED_NAME="neo4j-community-${NEO4J_VERSION}" # wget 可能会下载成这个名字

wget -q "${NEO4J_TAR_URL}" -O "${NEO4J_DOWNLOADED_TAR}"

# 检查下载是否成功
if [ ! -f "${NEO4J_DOWNLOADED_TAR}" ]; then
    echo "错误：Neo4j 下载失败。请检查 URL 或网络连接。"
    exit 1
fi

sudo tar -xzf "${NEO4J_DOWNLOADED_TAR}" -C "${NEO4J_EXTRACT_BASE_DIR}"

# 检查解压后目录是否存在并移动
if [ -d "${NEO4J_EXTRACT_BASE_DIR}/${NEO4J_EXTRACTED_NAME}" ]; then
    sudo mv "${NEO4J_EXTRACT_BASE_DIR}/${NEO4J_EXTRACTED_NAME}" "${NEO4J_FINAL_DIR}"
else
    echo "错误：Neo4j 解压后未找到目录 '${NEO4J_EXTRACT_BASE_DIR}/${NEO4J_EXTRACTED_NAME}'。"
    exit 1
fi

sudo rm "${NEO4J_DOWNLOADED_TAR}" # 清理安装包

# Neo4j 数据和日志目录
NEO4J_DATA_DIR="${DATA_BASE_DIR}/neo4j_data"
NEO4J_LOGS_DIR="${DATA_BASE_DIR}/neo4j_logs"
sudo mkdir -p "${NEO4J_DATA_DIR}" "${NEO4J_LOGS_DIR}"
sudo chown -R "$(whoami)":"$(whoami)" "${NEO4J_DATA_DIR}" "${NEO4J_LOGS_DIR}"

# 修改 Neo4j 配置
NEO4J_CONF_FILE="${NEO4J_FINAL_DIR}/conf/neo4j.conf"
# 备份原始文件
sudo cp "${NEO4J_CONF_FILE}" "${NEO4J_CONF_FILE}.backup"

# 修改配置文件，允许远程连接，设置端口和认证
# 注意：sed 命令中的路径需要转义，因为包含了 /
sudo sed -i "s|#dbms.connector.bolt.listen_address=0.0.0.0:7687|dbms.connector.bolt.listen_address=0.0.0.0:${NEO4J_PORT}|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|#dbms.connector.http.listen_address=0.0.0.0:7474|dbms.connector.http.listen_address=0.0.0.0:${NEO4J_HTTP_PORT}|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|#dbms.security.auth_enabled=true|dbms.security.auth_enabled=true|g" "${NEO4J_CONF_FILE}" # 确保认证启用
# 配置数据和日志目录
sudo sed -i "s|#dbms.directories.data=data|dbms.directories.data=${NEO4J_DATA_DIR}|g" "${NEO4J_CONF_FILE}"
sudo sed -i "s|#dbms.directories.logs=logs|dbms.directories.logs=${NEO4J_LOGS_DIR}|g" "${NEO4J_CONF_FILE}"


# 启动 Neo4j 服务
echo "正在启动 Neo4j..."
"${NEO4J_FINAL_DIR}/bin/neo4j" start
sleep 10 # 等待 Neo4j 启动并初始化
echo "Neo4j 启动完成。"

# 第一次启动后，Neo4j 会要求修改密码
echo "正在修改 Neo4j 默认密码..."
NEO4J_CYPHER_SHELL="${NEO4J_FINAL_DIR}/bin/cypher-shell"
if [ -f "${NEO4J_CYPHER_SHELL}" ]; then
    # 等待 Neo4j Bolt 端口可连接
    echo "等待 Neo4j Bolt 端口 ${NEO4J_PORT} 可用..."
    COUNT=0
    while ! nc -z ${NEO4J_HOST} ${NEO4J_PORT} && [ $COUNT -lt 15 ]; do
        sleep 2
        COUNT=$((COUNT+1))
    done

    if [ $COUNT -lt 15 ]; then
        # 使用 cypher-shell 修改密码
        # 移除 --encrypted=false 参数
        echo "CALL dbms.security.changeUserPassword('${NEO4J_PASSWORD}')" | "${NEO4J_CYPHER_SHELL}" -u neo4j -p neo4j --address "${NEO4J_HOST}:${NEO4J_PORT}"
        if [ $? -ne 0 ]; then
            echo "警告：cypher-shell 自动修改密码失败。请手动更改 Neo4j 密码。"
            echo "请尝试运行：${NEO4J_CYPHER_DIR}/bin/cypher-shell -u neo4j -p neo4j --address ${NEO4J_HOST}:${NEO4J_PORT}"
            echo "然后执行：ALTER USER neo4j SET PASSWORD '${NEO4J_PASSWORD}';"
        fi
    else
        echo "错误：Neo4j Bolt 端口未在预期时间内开放，无法连接 cypher-shell。"
    fi
else
    echo "警告：cypher-shell 未找到。无法自动更改 Neo4j 密码，请手动更改。"
    echo "请在 Neo4j 启动后，尝试手动找到 cypher-shell 并执行密码修改。"
fi
echo "Neo4j 密码修改尝试完成。"


# --- 总结 ---
echo ""
echo "--- 所有数据库安装和配置脚本已运行完成 ---"
echo "请注意：这些数据库将在容器内运行，但数据是非持久化的，除非容器启动时有挂载外部卷。"
echo "以下是连接信息："
echo "--------------------------------------------------"
echo "MongoDB:"
echo "  Host: ${MONGO_HOST}"
echo "  Port: ${MONGO_PORT}"
echo "  Username: ${MONGO_USERNAME}"
echo "  Password: ${MONGO_PASSWORD}"
echo "  Database: ${MONGO_DB_NAME}"
echo "--------------------------------------------------"
echo "MinIO:"
echo "  Host: ${MINIO_HOST}"
echo "  Port: ${MINIO_PORT}"
echo "  Access Key: ${MINIO_USERNAME}"
echo "  Secret Key: ${MINIO_PASSWORD}"
echo "  Console URL: http://${MINIO_HOST}:${MINIO_PORT}"
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
echo "--------------------------------------------------"
echo "Neo4j:"
echo "  Host: ${NEO4J_HOST}"
echo "  Bolt Port: ${NEO4J_PORT}"
echo "  HTTP Port: ${NEO4J_HTTP_PORT}"
echo "  Username: ${NEO4J_USERNAME}"
echo "  Password: ${NEO4J_PASSWORD}"
echo "--------------------------------------------------"

echo ""
echo "请手动检查各个服务的状态，确保它们已成功启动。"
echo "  MongoDB: ps aux | grep mongod"
echo "  MinIO: ps aux | grep minio"
echo "  Redis: ps aux | grep redis-server"
echo "  Neo4j: ${NEO4J_FINAL_DIR}/bin/neo4j status"
echo ""