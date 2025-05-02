#!/bin/bash
# AWS EC2 Deployment Helper Script for AI Govern

# Exit on any error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Display help message
show_help() {
  echo -e "${YELLOW}AI Govern AWS Deployment Helper${NC}"
  echo "Usage: $0 [OPTIONS] COMMAND"
  echo ""
  echo "Commands:"
  echo "  setup        Install Docker and Docker Compose on EC2"
  echo "  deploy       Deploy the application using docker-compose"
  echo "  status       Check the status of running containers"
  echo "  logs         View container logs"
  echo "  update       Update the application with the latest code"
  echo "  backup       Create a database backup"
  echo "  db-setup     Setup a PostgreSQL container (development only)"
  echo ""
  echo "Options:"
  echo "  -h, --help   Show this help message"
  echo "  -e, --env    Path to .env file (default: ./.env)"
  echo ""
  echo "Examples:"
  echo "  $0 setup                # Install Docker and Docker Compose"
  echo "  $0 deploy               # Deploy the application"
  echo "  $0 --env ./prod.env deploy  # Deploy with specific env file"
  echo "  $0 logs                 # View all container logs"
  echo "  $0 logs frontend        # View only frontend logs"
}

# Parse arguments
ENV_FILE="./.env"

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    -e|--env)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      COMMAND=$1
      shift
      ARGS=("$@")
      break
      ;;
  esac
done

# Check if environment file exists
check_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: Environment file $ENV_FILE not found${NC}"
    echo -e "Create an .env file from .env.example or specify one with --env"
    exit 1
  fi
}

# Install Docker and Docker Compose
setup_ec2() {
  echo -e "${YELLOW}Setting up Docker and Docker Compose...${NC}"
  
  # Detect OS
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
  else
    echo -e "${RED}Unable to detect OS${NC}"
    exit 1
  fi
  
  if [[ "$OS" == *"Amazon Linux"* ]]; then
    # Amazon Linux
    echo -e "${GREEN}Detected Amazon Linux${NC}"
    sudo yum update -y
    sudo amazon-linux-extras install docker -y
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
  elif [[ "$OS" == *"Ubuntu"* ]]; then
    # Ubuntu
    echo -e "${GREEN}Detected Ubuntu${NC}"
    sudo apt update
    sudo apt install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
  else
    echo -e "${RED}Unsupported OS: $OS${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}Docker and Docker Compose installed successfully${NC}"
  echo "Please log out and log back in for group changes to take effect"
}

# Deploy the application
deploy_app() {
  check_env_file
  
  echo -e "${YELLOW}Deploying AI Govern application...${NC}"
  
  # Load environment variables
  set -a
  source "$ENV_FILE"
  set +a
  
  # Build and start containers
  docker-compose -f docker-compose.prod.yml up -d
  
  echo -e "${GREEN}Application deployed successfully${NC}"
  echo "Frontend: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):${FRONTEND_PORT:-80}"
  echo "Backend: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):${BACKEND_PORT:-5000}"
}

# Check container status
check_status() {
  echo -e "${YELLOW}Checking container status...${NC}"
  docker-compose -f docker-compose.prod.yml ps
}

# View container logs
view_logs() {
  if [ -z "${ARGS[0]}" ]; then
    echo -e "${YELLOW}Viewing all container logs...${NC}"
    docker-compose -f docker-compose.prod.yml logs
  else
    echo -e "${YELLOW}Viewing ${ARGS[0]} logs...${NC}"
    docker-compose -f docker-compose.prod.yml logs "${ARGS[0]}"
  fi
}

# Update the application
update_app() {
  check_env_file
  
  echo -e "${YELLOW}Updating AI Govern application...${NC}"
  
  # Pull the latest code
  git pull
  
  # Rebuild and restart containers
  docker-compose -f docker-compose.prod.yml down
  docker-compose -f docker-compose.prod.yml build
  docker-compose -f docker-compose.prod.yml up -d
  
  echo -e "${GREEN}Application updated successfully${NC}"
}

# Create a database backup
backup_db() {
  echo -e "${YELLOW}Creating database backup...${NC}"
  
  BACKUP_FILE="backup_$(date +%Y-%m-%d_%H-%M-%S).sql"
  
  if docker-compose -f docker-compose.prod.yml ps | grep -q postgres; then
    # Postgres is running in our docker-compose
    docker exec -t postgres pg_dump -U ai_govern_user ai_govern > "$BACKUP_FILE"
  else
    # Using external database - load from .env file
    check_env_file
    
    # Load environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Extract database connection details from DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | sed -E 's/.*@([^:]+):.*/\1/')
    DB_PORT=$(echo $DATABASE_URL | sed -E 's/.*:([0-9]+)\/.*/\1/')
    DB_USER=$(echo $DATABASE_URL | sed -E 's/.*:\/\/([^:]+):.*/\1/')
    DB_NAME=$(echo $DATABASE_URL | sed -E 's/.*\/([^?]+).*/\1/')
    
    # Create backup
    PGPASSWORD=$(echo $DATABASE_URL | sed -E 's/.*:([^@]+)@.*/\1/') pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
  fi
  
  echo -e "${GREEN}Database backup created: $BACKUP_FILE${NC}"
}

# Setup a PostgreSQL container (for development)
setup_db() {
  echo -e "${YELLOW}Setting up PostgreSQL container...${NC}"
  
  docker network create ai_govern_db_network || true
  
  docker run -d \
    --name postgres \
    --network ai_govern_db_network \
    -e POSTGRES_USER=ai_govern_user \
    -e POSTGRES_PASSWORD=ai_govern_password \
    -e POSTGRES_DB=ai_govern \
    -p 5432:5432 \
    -v postgres_data:/var/lib/postgresql/data \
    postgres:15-alpine
  
  echo -e "${GREEN}PostgreSQL container created successfully${NC}"
  echo "Connection string: postgresql://ai_govern_user:ai_govern_password@localhost:5432/ai_govern"
}

# Execute the command
case $COMMAND in
  setup)
    setup_ec2
    ;;
  deploy)
    deploy_app
    ;;
  status)
    check_status
    ;;
  logs)
    view_logs
    ;;
  update)
    update_app
    ;;
  backup)
    backup_db
    ;;
  db-setup)
    setup_db
    ;;
  *)
    echo -e "${RED}Unknown command: $COMMAND${NC}"
    show_help
    exit 1
    ;;
esac

exit 0