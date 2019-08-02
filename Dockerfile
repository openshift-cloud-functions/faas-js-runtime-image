FROM node:12-alpine

EXPOSE 8080

USER 1000

COPY src /home/node/src
RUN mkdir /home/node/usr

CMD ["/home/node/src/run.sh"]