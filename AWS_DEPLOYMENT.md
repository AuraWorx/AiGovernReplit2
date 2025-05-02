# AWS EC2 Deployment Guide for AI Govern

This guide outlines how to deploy the AI Govern application on AWS EC2 instances using Docker.

## Prerequisites

1. An AWS account with EC2 access
2. Docker and Docker Compose installed on your EC2 instance
3. A PostgreSQL database (either RDS or self-managed)
4. Domain names configured (optional but recommended)

## Deployment Steps

### 1. Prepare the EC2 Instance

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

# Apply changes
sudo reboot
```

### 2. Clone the Repository

```bash
git clone <your-repository-url>
cd <repository-directory>
```

### 3. Configure Environment Variables

Create a `.env` file based on the `.env.example` template:

```bash
cp .env.example .env
nano .env  # Edit with your specific values
```

Important environment variables to set:
- `DATABASE_URL`: Your PostgreSQL connection string
- `SESSION_SECRET`: A secure random string for session encryption
- `VITE_API_URL`: The public URL of your backend API

### 4. Deploy with Docker Compose

For production deployment:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

This will start both the frontend and backend containers in detached mode.

### 5. Configure Nginx (Optional but Recommended)

If you want to set up proper domain names and SSL:

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

# Configure Nginx sites for your domains
sudo nano /etc/nginx/sites-available/frontend
sudo nano /etc/nginx/sites-available/backend

# Enable sites
sudo ln -s /etc/nginx/sites-available/frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/backend /etc/nginx/sites-enabled/

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# Set up SSL
sudo certbot --nginx -d frontend.yourdomain.com -d backend.yourdomain.com
```

### 6. Verify Deployment

- Frontend: Visit `http://<your-ec2-public-ip>` or your configured domain
- Backend API: Test `http://<your-ec2-public-ip>:5000/api/health` or your configured domain

## Updating the Application

To update the application:

```bash
# Pull latest changes
git pull

# Rebuild and restart containers
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

## Monitoring and Logs

View logs for containers:

```bash
# All logs
docker-compose -f docker-compose.prod.yml logs

# Specific service logs
docker-compose -f docker-compose.prod.yml logs frontend
docker-compose -f docker-compose.prod.yml logs backend

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f
```

## Backup and Restore

If you're using a containerized database:

```bash
# Backup PostgreSQL data
docker exec -t postgres pg_dump -U ai_govern_user ai_govern > backup_$(date +%Y-%m-%d_%H-%M-%S).sql

# Restore from backup
cat backup_file.sql | docker exec -i postgres psql -U ai_govern_user -d ai_govern
```

## Troubleshooting

1. **Container won't start:** Check logs with `docker-compose -f docker-compose.prod.yml logs`
2. **Database connection issues:** Verify DATABASE_URL and network connectivity
3. **Frontend can't reach backend:** Ensure VITE_API_URL is correctly set and Nginx is properly configured