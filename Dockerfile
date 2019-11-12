FROM node:12-alpine

EXPOSE 8080

ARG home_dir="/home/node"

COPY src ${home_dir}/src
COPY s2i /usr/libexec/s2i

RUN mkdir -p ${home_dir}/usr && \
  chmod -R 777 ${home_dir} && \
  cd ${home_dir}/src && \
  npm install

ENV HOME $home_dir

USER 1001

CMD ${HOME}/src/run.sh
