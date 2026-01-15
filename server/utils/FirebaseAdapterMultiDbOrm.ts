import { FireStoreDB } from "multi-db-orm";
import { PipelaneUtils } from ".";
import { TableName } from "../db";

export class FirebaseAdapterMultiDbOrm extends FireStoreDB {

    insert(modelname: string, object: any, id?: string): Promise<any> {

        if (modelname == TableName.PS_PIPELANE_TASK && object.pipelaneName && object.name) {
            object.id = object.id || PipelaneUtils.generatePipelaneTaskId(object.pipelaneName, object.name)
        }
        if (modelname == TableName.PS_PIPELANE && object.name && !object.pipelaneName) {
            object.id = object.id || PipelaneUtils.generatePipelaneId(object.name)
        }

        return super.insert(modelname, object, id);
    }

    async update(modelname: string, filter: any, object: any, id?: string): Promise<any> {
        if (modelname == TableName.PS_PIPELANE_TASK) {
            // special handling to generate id if pipelaneName is updated when renaming a pipe
            if (!object.name && object.pipelaneName) {
                const existingTasks = await this.get(modelname, filter)
                return Promise.all(
                    existingTasks.map(async (et: any) => {
                        super.delete(modelname, { pipelaneName: et.pipelaneName, name: et.name });
                        et.pipelaneName = object.pipelaneName;
                        et.id = PipelaneUtils.generatePipelaneTaskId(object.pipelaneName, et.name);
                        return super.insert(modelname, et);
                    })
                )
            }
            else {
                object.id = object.id || PipelaneUtils.generatePipelaneTaskId(object.pipelaneName, object.name)
            }
        }
        else if (modelname == TableName.PS_PIPELANE && object.name) {
            object.id = object.id || PipelaneUtils.generatePipelaneId(object.name)
        }
        return super.update(modelname, filter, object, id);
    }

}