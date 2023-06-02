import tap from 'tap';
import eik from '@eik/core';
import { withDefaults } from '../lib/config.js';

tap.test('config - use default simple values', async (t) => {
    const config = withDefaults({});
    t.equal(config.env, 'development', 'default env should be "development"');
});

tap.test('config - provided config should override defaults', async (t) => {
    const config = withDefaults({
        name: 'overridden',
    });
    t.equal(config.name, 'overridden', 'provided name should override default');
});

tap.test('config - use default object values', async (t) => {
    const config = withDefaults({});
    t.same(config.log, { level: 'info' }, 'default log level should be "info"');
});

tap.test(
    'config - provided object values should override default',
    async (t) => {
        const config = withDefaults({
            log: {
                level: 'debug',
                other: 'value',
            },
        });
        t.same(
            config.log,
            { level: 'debug', other: 'value' },
            'default log level should be "info"',
        );
    },
);

tap.test(
    'config - default object values should not override other object content',
    async (t) => {
        const config = withDefaults({
            log: {
                other: 'value',
            },
        });
        t.same(
            config.log,
            { level: 'info', other: 'value' },
            'default log level should be "info"',
        );
    },
);

tap.test(
    "config - don't apply default value on sink when providing a custom Sink",
    async (t) => {
        const customSink = new eik.sink.MEM();
        const config = withDefaults({
            sink: customSink,
        });
        t.equal(
            config.sink,
            customSink,
            'customSink should not be overridden by default value',
        );
    },
);
