# AWS EC2 Deployment Guide for AI Govern

This guide outlines how to deploy the AI Govern application on AWS EC2 instances using Docker.

## Prerequisites

1. An AWS account with EC2 access
2. Docker and Docker Compose installed on your EC2 instance
3. A PostgreSQL database (either AWS RDS or self-managed)
4. Domain names configured (optional but recommended)

## Architecture Overview

The AI Govern application is designed to run in two separate Docker containers:

1. **Frontend Container**: Nginx serving compiled React application
2. **Backend Container**: Node.js Express application providing API services

This separation allows for independent scaling and maintenance of each component.

## Deployment Steps

### 1. Set Up the AWS EC2 Instance

1. Launch an EC2 instance with Amazon Linux 2 or Ubuntu
   - Recommended: t3.medium or larger
   - Security Group: Allow inbound traffic on ports 22 (SSH), 80 (HTTP), 443 (HTTPS), and 5000 (API)

2. Install Docker and Docker Compose:

```bash
# Update system packages
sudo yum update -y  # For Amazon Linux
# OR
sudo apt update && sudo apt upgrade -y  # For Ubuntu

# Install Docker
sudo amazon-linux-extras install docker  # For Amazon Linux
# OR
sudo apt install docker.io -y  # For Ubuntu

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and log back in for group changes to take effect
exit
# Log back in...
```

### 2. Set Up PostgreSQL Database

Option 1: Use AWS RDS
1. Create a PostgreSQL RDS instance
2. Configure security group to allow traffic from your EC2 instance
3. Note the endpoint, username, password, and database name

Option 2: Self-managed PostgreSQL container (simpler for development/testing)
```bash
# Create a docker network for the database
docker network create ai_govern_db_network

# Run a PostgreSQL container
docker run -d \
  --name postgres \
  --network ai_govern_db_network \
  -e POSTGRES_USER=ai_govern_user \
  -e POSTGRES_PASSWORD=ai_govern_password \
  -e POSTGRES_DB=ai_govern \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine
```

### 3. Deploy the Application

1. Clone the repository:
```bash
git clone <your-repository-url>
cd <repository-directory>
```

2. Create a `.env` file for production configuration:
```bash
cat > .env << EOF
# Database configuration
DATABASE_URL=postgresql://ai_govern_user:ai_govern_password@<your-db-host>:5432/ai_govern

# Security
SESSION_SECRET=$(openssl rand -hex 32)  # Generates a secure random string

# API URL - update with your actual domain or IP
API_URL=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):5000

# Optional settings
FRONTEND_PORT=80
BACKEND_PORT=5000
UPLOADS_DIR=./uploads
EOF
```

3. Build and run the containers:
```bash
# Build and start the containers
docker-compose -f docker-compose.prod.yml up -d

# Check the status
docker-compose -f docker-compose.prod.yml ps
```

### 4. Set Up Domain Names and SSL (recommended for production)

1. Install Nginx and Certbot:
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

2. Create Nginx configurations:

For the frontend:
```bash
sudo tee /etc/nginx/sites-available/frontend << EOF
server {
    server_name app.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
```

For the backend:
```bash
sudo tee /etc/nginx/sites-available/backend << EOF
server {
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
```

3. Enable the sites and set up SSL:
```bash
# Enable sites
sudo ln -s /etc/nginx/sites-available/frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/backend /etc/nginx/sites-enabled/

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# Set up SSL
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com
```

### 5. Verify the Deployment

1. Test the frontend: 
   - Navigate to `http://<your-ec2-public-ip>` or `https://app.yourdomain.com`

2. Test the backend API: 
   - Make a request to `http://<your-ec2-public-ip>:5000/api/user` or `https://api.yourdomain.com/api/user`

## Maintenance and Operations

### Updating the Application

To update the application with the latest code:

```bash
# Pull latest changes
git pull

# Rebuild and restart containers
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### Monitoring the Application

Set up CloudWatch monitoring for your EC2 instance:

```bash
# Install CloudWatch agent
sudo yum install amazon-cloudwatch-agent  # For Amazon Linux
# OR
sudo apt install amazon-cloudwatch-agent  # For Ubuntu

# Configure and start the agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
sudo systemctl start amazon-cloudwatch-agent
```

### Container Logs and Troubleshooting

View container logs:

```bash
# All logs
docker-compose -f docker-compose.prod.yml logs

# Frontend logs
docker-compose -f docker-compose.prod.yml logs frontend

# Backend logs
docker-compose -f docker-compose.prod.yml logs backend

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f
```

### Backing Up the Database

If using a containerized PostgreSQL database:

```bash
# Create a backup
docker exec -t postgres pg_dump -U ai_govern_user ai_govern > backup_$(date +%Y-%m-%d_%H-%M-%S).sql

# Restore from backup
cat backup_file.sql | docker exec -i postgres psql -U ai_govern_user -d ai_govern
```

If using AWS RDS:
- Use RDS automated backups or snapshots
- Or use pg_dump connected to your RDS instance:
```bash
pg_dump -h <your-rds-endpoint> -U ai_govern_user -d ai_govern > backup_$(date +%Y-%m-%d_%H-%M-%S).sql
```

## Troubleshooting Common Issues

1. **Container build failures:**
   - Check Docker build logs: `docker-compose -f docker-compose.prod.yml build --no-cache`
   - Verify all files are properly copied in the Dockerfile

2. **Database connection issues:**
   - Verify DATABASE_URL environment variable
   - Check security group settings allow traffic from EC2 to RDS
   - Test connection: `docker exec -it backend curl -v <db-host>:5432`

3. **Frontend can't connect to backend API:**
   - Verify VITE_API_URL is correctly set
   - Check Nginx configuration
   - Test API directly: `curl http://localhost:5000/api/health`

4. **SSL certificate issues:**
   - Renew certificates: `sudo certbot renew`
   - Check certificate: `sudo certbot certificates`