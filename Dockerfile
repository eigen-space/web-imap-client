FROM node:13.7

# Set a directory for the app
WORKDIR /opt/services/scanner/

# Copy all the files to the container
COPY . ./project

# Install deps
RUN cd ./project && yarn
RUN cd ./project && yarn build

# Move builded project into data-studio directory
RUN cp -a project/dist/. ./
# Remove source code files
RUN rm -r project

# Install deps for builded output
RUN yarn

# Tell the port number the container should expose
EXPOSE 3230

# Start the service
ENTRYPOINT ["node", "./index.js"]
