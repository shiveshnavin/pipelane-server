import { CronScheduler } from ".";
import { Pipelane } from "../../gen/model";

let pipe: Pipelane = {
    name: 'test',
    active: true,
    schedule: '*/5 * * * *'
};

let sch = new CronScheduler();
sch.init([pipe], (p) => {
    return p
})

function assertEquals(lv, rv, msg?) {
    if (lv != rv) {
        console.error(`Expected ${lv} to be equal to ${rv}.`, msg)
    }
}
assertEquals(sch.validateCronString('*/5 * * * *'), true, 'check cron validation')
assertEquals(sch.validateCronString('*/5 * **'), false, 'check cron validation')

for (let i = 0; i < 120; i++) {
    let cur = Date.now() + i * 1000 * 60
    pipe.updatedTimestamp = `${cur}`
    let run = sch.isPipeRunnable(pipe)
    if (run)
        console.log('Running')
}