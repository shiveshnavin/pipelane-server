# Pipelane server

### cron

https://github.com/kelektiv/node-cron/issues/190

### Hosting

Build the models

```
cd pipelane-server
yarn install
```

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
