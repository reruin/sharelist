FROM node:14-alpine
LABEL maintainer=reruin

ADD . /sharelist/
WORKDIR /sharelist
VOLUME /sharelist/cache
VOLUME /sharelist/theme
VOLUME /sharelist/plugin

RUN npm install --production

ENV HOST 0.0.0.0
ENV PORT 33001

EXPOSE 33001

CMD ["npm", "start"]