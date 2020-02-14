/* @flow */
import uuidv4 from 'uuid';
import requestPromise from 'request-promise';

export function ValidationError(message : string) {
    this.name = 'ValidationError';
    this.message = (message || '');
}

// $FlowFixMe
ValidationError.prototype = Error.prototype;

type HandlerOptionsType = {
    log? : boolean
};

export function handler<T : Object>(fn : (req : express$Request, res : express$Response) => Promise<T>, opts : HandlerOptionsType = {}) : (req : express$Request, res : express$Response) => Promise<void> {
    return async (req : express$Request, res : express$Response) => {
        let uuid = uuidv4();

        try {
            if (opts.log) {
                console.log(uuid, req.originalUrl, req.body);
            }
            res.writeHead(200, { 'content-type': 'application/json' });
            res.write('   ');
            let result = await fn(req, res);
            res.write(JSON.stringify(result, null, 4));
            res.end();
        } catch (err) {
            console.error(uuid, err.stack || err.message || err.toString());

            let message = 'Internal server error';

            if (err instanceof ValidationError) {
                message = err.message;
            }

            res.write(JSON.stringify({ status: 'error', message, uuid }, null, 4));
            res.end();
        }
    };
}
