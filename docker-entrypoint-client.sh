#!/bin/sh
set -e
# PaaS platforms set PORT; local Docker defaults to 80 (see docker-compose.yml).
PORT="${PORT:-80}"
sed -i "s/listen 80;/listen ${PORT};/" /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
