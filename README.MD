# Pipelane server

### cron

https://github.com/kelektiv/node-cron/issues/190

### Hosting

Host the app at

```

creatPipelaneServer(
    variantConfig,
    db
).then(pipelaneApp => {

    app.use('/pipelane', pipelaneApp)
    app.listen(...)
})
```
