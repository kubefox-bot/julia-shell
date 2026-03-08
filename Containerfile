FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

RUN yarn install --immutable

COPY . .

RUN yarn build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
