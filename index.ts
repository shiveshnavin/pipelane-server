import getApp from "./server";

const port = process.env.PORT || 4000
getApp().then((app: any) => {
    app.listen(port)
    console.log(`Running a GraphQL API server at http://localhost:${port}/graph`)

})