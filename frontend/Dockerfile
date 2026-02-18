FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy PDF.js worker to public directory
RUN mkdir -p public && cp node_modules/pdfjs-dist/build/pdf.worker.min.js public/pdf.worker.min.js

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Run development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
