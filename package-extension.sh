#!/bin/bash

# Create a zip file of the Chrome extension
cd chrome-plugin
zip -r ../youtube-comment-analyzer-extension.zip .
echo "Chrome extension packaged as youtube-comment-analyzer-extension.zip"