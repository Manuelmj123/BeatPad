FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# --host 0.0.0.0 binds Vite to all interfaces so Docker port-mapping works
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
