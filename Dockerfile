FROM node:12-alpine

EXPOSE 8080

COPY src /home/node/src
RUN mkdir /home/node/usr

RUN cd /home/node/src && npm install

USER 1000

CMD ["/home/node/src/run.sh"]