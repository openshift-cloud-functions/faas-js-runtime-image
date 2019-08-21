FROM node:12-alpine

EXPOSE 8080

COPY src /home/node/src

RUN mkdir -p /home/node/usr && \
  chmod -R 777 /home/node && \
  cd /home/node/src && \
  npm install

ENV HOME /home/node

USER 1001

CMD ["/home/node/src/run.sh"]
