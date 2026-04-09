FROM public.ecr.aws/docker/library/node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      bash \
      bubblewrap \
      ca-certificates \
      curl \
      git \
      jq \
      less \
      openssh-client \
      python3 \
      make \
      g++ \
      ripgrep \
      tmux \
    && npm install -g @openai/codex \
    && mv /usr/local/bin/codex /usr/local/bin/codex-real \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
RUN npm ci --workspace server

COPY server/src ./server/src
COPY server/bashrc /root/.bashrc
COPY server/tmux.conf /root/.tmux.conf
COPY server/codex-wrapper.sh /usr/local/bin/codex

RUN chmod +x /usr/local/bin/codex

ENV PORT=4020
ENV HOST=0.0.0.0
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV TERM=xterm-256color

WORKDIR /app/server

EXPOSE 4020

CMD ["npm", "run", "start"]
