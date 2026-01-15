import { FireStoreDB } from "multi-db-orm";
import { PipelaneUtils } from ".";

export class FirebaseAdapterMultiDbOrm extends FireStoreDB {

    insert(modelname: string, object: any, id?: string): Promise<any> {
        // pipetask step management
        if (object.pipelaneName) {
            object.id = PipelaneUtils.generatePipelaneTaskId(object.pipelaneName, object.name)
        }
        else if (object.name) {
            object.id = PipelaneUtils.generatePipelaneId(object.name)
        }

        return super.insert(modelname, object, id);
    }

    update(modelname: string, filter: any, object: any, id?: string): Promise<any> {
        if (object.pipelaneName) {
            object.id = PipelaneUtils.generatePipelaneTaskId(object.pipelaneName, object.name)
        }
        else if (object.name) {
            object.id = PipelaneUtils.generatePipelaneId(object.name)
        }
        return super.update(modelname, filter, object, id);
    }

}