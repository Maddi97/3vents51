FROM node:16.2 as build

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

COPY package.json /app/package.json
RUN yarn install

COPY . /app

RUN ng build --output-path=dist --prod=true

FROM nginx:1.16.0-alpine

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
