FROM node:16.2.0

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
RUN apt-get update && apt-get install -yq google-chrome-stable

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

COPY package.json /app/package.json

RUN npm install --legacy-peer-deps
RUN npm install -g @angular/cli@10.0.6

RUN npm install --save-dev @angular-devkit/build-angular --legacy-peer-deps

COPY . /app

RUN ng update --all --force

CMD ng serve --host 0.0.0.0 --prod=false
