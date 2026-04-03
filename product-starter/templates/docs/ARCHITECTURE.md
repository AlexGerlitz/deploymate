# Architecture

## Product

`{{PROJECT_NAME}}`

## Starter topology

```text
Browser
  -> Next.js frontend
    -> FastAPI backend
      -> primary database
```

## First decisions to lock

1. auth model
2. storage model
3. deployment target
4. billing/contact flow
5. audit/logging expectations
