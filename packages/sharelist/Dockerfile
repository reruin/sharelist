FROM node:20-alpine
LABEL maintainer=reruin

ADD . /sharelist/
WORKDIR /sharelist
VOLUME /sharelist/cache

RUN npm install --production

ENV HOST 0.0.0.0
ENV PORT 33001

EXPOSE 33001

CMD ["npm", "start"]