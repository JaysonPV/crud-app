FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

# Installer nginx + supervisor
RUN apt-get update && apt-get install -y nginx supervisor && rm -rf /var/lib/apt/lists/*

# Copier conf nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Créer dossier logs
RUN mkdir -p /var/logs/crud && chmod 777 /var/logs/crud

# Copier conf supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 3000 80

# Supervisor lance nginx + node
CMD ["/usr/bin/supervisord", "-n"]
