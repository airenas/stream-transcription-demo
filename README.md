# Real-Time Stream Transcription Demo

Welcome to the Real-Time Stream Transcription project! In this README, we'll cover how to get started with the demo. This project extends https://github.com/Kaljurand/dictate.js, https://github.com/jcsilva/docker-kaldi-gstreamer-server, and https://github.com/alumae/kaldi-gstreamer-server.

## Demo
The real-time transcription depends on language-specific Kaldi model files. You can get one using the instructions at https://github.com/alumae/kaldi-gstreamer-server. Or for Lithuanian, contact us, intelektika.lt to help with it.

To start the demo locally:
1. Acquire the model and extract it into `example/docker-compose/models`
2. Start the demo
```bash
   cd exampple/docker-compose
   docker compose up -d
```
3. Open your web browser and navigate to http://localhost:8080. You should now see the demo running locally.

### Clean 
Stop the demo    
```bash
    docker compose down
```

## Development

Before getting started, ensure you have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) (Node Package Manager) installed on your system. Follow these steps to install the project's dependencies:

Install the project's dependencies using npm:
```bash
    npm install
```    

This will download and install all the necessary packages and dependencies required to run the application.

Start the development server:
```bash
    npm start
```

## Docker image

CI is configured to build the demo container. To create one:
1. Make changes to the code
2. Push changes
3. Create tag: `git tag v0.1.2`
4. Push the tag: `git push --tags`
5. This will trigger the automated build and push process for the Docker image. Users can then pull and run the image to deploy the latest release of the application.
6. Access it: `docker -d run -p 8080:8080 intelektikalt/stream-transcriber-demo:0.1.2`

