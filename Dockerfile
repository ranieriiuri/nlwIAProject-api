FROM node:20
WORKDIR /plasmator-api
COPY package.json pnpm-lock.yaml /plasmator-api/

COPY . .

RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build
EXPOSE 3333

CMD [ "pnpm", "dev" ]



