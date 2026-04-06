FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:22

# rakaly binary — must be present before `sls deploy` (run `make prepare`)
COPY rakaly /opt/bin/rakaly
RUN chmod +x /opt/bin/rakaly

# Pre-compiled handler bundle — produced by `make build` (esbuild)
COPY dist/handler.js ./handler.js

CMD ["handler.handler"]
