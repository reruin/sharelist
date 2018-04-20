FROM node:8-alpine
MAINTAINER reruin

ADD . /app/
WORKDIR /app
VOLUME /app/cache

RUN npm install

ENV HOST 0.0.0.0
ENV PORT 33001

EXPOSE 33001

CMD ["npm", "start"]