import test from 'node:test';
import assert from 'node:assert/strict';
import { sendToWorkflow } from '../js/workflow.js';
import { config, services } from '../js/config.js';
const session = { id:'test-session', serviceId:'review', messages:[{role:'system',content:'local note'},{role:'user',content:'compare'}] };
const workflow = { url:'https://example.com/webhook/review', timeoutMs:1000 };

test('each service has an independent workflow configuration and a unique ID', () => {
  assert.equal(new Set(services.map(service => service.id)).size, services.length);
  services.forEach(service => assert.ok(Object.hasOwn(config.workflows, service.id)));
  assert.equal(config.auth.enabled, false);
});
test('unconfigured service never sends a network request', async () => {
  const result = await sendToWorkflow({workflow:{url:''},session,message:'compare',fetcher:() => { throw Error('must not fetch'); }});
  assert.deepEqual(result,{connected:false});
});
test('sends service, session, filtered history, and file bytes to the selected workflow', async () => {
  const file = new File(['drawing'], 'plan.dxf', {type:'application/dxf'});
  const result = await sendToWorkflow({workflow,session,message:'compare',files:[file],fetcher:async (url, options) => {
    assert.equal(url, workflow.url);
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('serviceId'), 'review');
    assert.equal(options.body.get('sessionId'), 'test-session');
    assert.equal(options.body.get('message'), 'compare');
    assert.deepEqual(JSON.parse(options.body.get('history')), [{role:'user',content:'compare'}]);
    assert.equal(await options.body.get('files').text(),'drawing');
    return Response.json({reply:'result'});
  }});
  assert.deepEqual(result,{connected:true,reply:'result'});
});
test('supports n8n array outputs and plain text responses', async () => {
  for (const response of [Response.json([{output:'done'}]),new Response('done')]) {
    assert.equal((await sendToWorkflow({workflow,session,message:'test',fetcher:async () => response})).reply,'done');
  }
});
test('rejects errors and empty or unsupported output rather than inventing a result', async () => {
  for (const response of [new Response('oops',{status:500}),Response.json({success:true}),new Response('')]) {
    await assert.rejects(sendToWorkflow({workflow,session,message:'test',fetcher:async () => response}));
  }
});
test('rejects insecure external endpoints before sending', async () => {
  await assert.rejects(sendToWorkflow({workflow:{url:'http://example.com'},session,message:'private'}), /HTTPS/);
});
test('aborts a stalled workflow without automatic retry', async () => {
  let requests = 0;
  await assert.rejects(sendToWorkflow({workflow:{...workflow,timeoutMs:10},session,message:'test',fetcher:(_url,{signal}) => {
    requests++;
    return new Promise((_resolve,reject) => signal.addEventListener('abort',() => reject(new Error('aborted'))));
  }}), /مهلة/);
  assert.equal(requests,1);
});
