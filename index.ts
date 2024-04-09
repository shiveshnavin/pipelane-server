import creatPipelaneServer from "./server";
import { VariantConfig } from "./server/pipe-tasks";

const port = process.env.PORT || 4000

creatPipelaneServer(VariantConfig).then((app: any) => {
    app.listen(port)
    console.log(`Running a GraphQL API server at http://localhost:${port}/graph`)
})