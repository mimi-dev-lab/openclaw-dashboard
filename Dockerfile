FROM nginx:alpine
COPY out/ /usr/share/nginx/html/

# 配置 Next.js 静态导出路由
RUN cat > /etc/nginx/conf.d/default.conf << 'NGINX'
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    # 处理 SPA 路由
    location / {
        try_files $uri $uri/index.html $uri.html /index.html;
    }
    
    # 静态资源缓存
    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

EXPOSE 80
