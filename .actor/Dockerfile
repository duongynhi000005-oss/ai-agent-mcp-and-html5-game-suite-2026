FROM apify/actor-node:20
COPY package*.json ./
RUN npm install --omit=dev --omit=optional || true
COPY . ./
CMD ["node", "apify_main.js"]