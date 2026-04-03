FROM public.ecr.aws/docker/library/node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM public.ecr.aws/docker/library/node:22-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=/api
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ARG NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0
ENV NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=${NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED}
ARG NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED=0
ENV NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED=${NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED}
ARG NEXT_PUBLIC_BUSINESS_CONTACT_EMAIL=alexgerlitz@users.noreply.github.com
ENV NEXT_PUBLIC_BUSINESS_CONTACT_EMAIL=${NEXT_PUBLIC_BUSINESS_CONTACT_EMAIL}
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM public.ecr.aws/docker/library/node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
