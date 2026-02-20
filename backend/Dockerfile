FROM node:20-bookworm-slim

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml .npmrc ./
COPY .yarn ./.yarn

RUN yarn install --immutable

COPY . .

RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 9000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
