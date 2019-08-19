FROM node:12-alpine

EXPOSE 8080

COPY src /home/node/src

RUN mkdir -p /home/node/usr/.npm && \
  chmod -R a+g /home/node/usr && \
  chmod -R a+g /home/node/src && \
  cd /home/node/src && \
  npm install

ENV HOME /home/node/usr

USER 1001

CMD ["/home/node/src/run.sh"]
