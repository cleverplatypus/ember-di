require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*jslint onevar:true, undef:true, newcap:true, regexp:true, bitwise:true, maxerr:50, indent:4, white:false, nomen:false, plusplus:false */
/*global define:false, require:false, exports:false, module:false, signals:false */

/** @license
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license
 * Author: Miller Medeiros
 * Version: 1.0.0 - Build: 268 (2012/11/29 05:48 PM)
 */

(function(global){

    // SignalBinding -------------------------------------------------
    //================================================================

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name SignalBinding
     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
     * @param {Function} listener Handler function bound to the signal.
     * @param {boolean} isOnce If binding should be executed just once.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @param {Number} [priority] The priority level of the event listener. (default = 0).
     */
    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {

        /**
         * Handler function bound to the signal.
         * @type Function
         * @private
         */
        this._listener = listener;

        /**
         * If binding should be executed just once.
         * @type boolean
         * @private
         */
        this._isOnce = isOnce;

        /**
         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @memberOf SignalBinding.prototype
         * @name context
         * @type Object|undefined|null
         */
        this.context = listenerContext;

        /**
         * Reference to Signal object that listener is currently bound to.
         * @type Signal
         * @private
         */
        this._signal = signal;

        /**
         * Listener priority
         * @type Number
         * @private
         */
        this._priority = priority || 0;
    }

    SignalBinding.prototype = {

        /**
         * If binding is active and should be executed.
         * @type boolean
         */
        active : true,

        /**
         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
         * @type Array|null
         */
        params : null,

        /**
         * Call listener passing arbitrary parameters.
         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
         * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
         * @return {*} Value returned by the listener.
         */
        execute : function (paramsArr) {
            var handlerReturn, params;
            if (this.active && !!this._listener) {
                params = this.params? this.params.concat(paramsArr) : paramsArr;
                handlerReturn = this._listener.apply(this.context, params);
                if (this._isOnce) {
                    this.detach();
                }
            }
            return handlerReturn;
        },

        /**
         * Detach binding from signal.
         * - alias to: mySignal.remove(myBinding.getListener());
         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
         */
        detach : function () {
            return this.isBound()? this._signal.remove(this._listener, this.context) : null;
        },

        /**
         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
         */
        isBound : function () {
            return (!!this._signal && !!this._listener);
        },

        /**
         * @return {boolean} If SignalBinding will only be executed once.
         */
        isOnce : function () {
            return this._isOnce;
        },

        /**
         * @return {Function} Handler function bound to the signal.
         */
        getListener : function () {
            return this._listener;
        },

        /**
         * @return {Signal} Signal that listener is currently bound to.
         */
        getSignal : function () {
            return this._signal;
        },

        /**
         * Delete instance properties
         * @private
         */
        _destroy : function () {
            delete this._signal;
            delete this._listener;
            delete this.context;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
        }

    };


/*global SignalBinding:false*/

    // Signal --------------------------------------------------------
    //================================================================

    function validateListener(listener, fnName) {
        if (typeof listener !== 'function') {
            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
        }
    }

    /**
     * Custom event broadcaster
     * <br />- inspired by Robert Penner's AS3 Signals.
     * @name Signal
     * @author Miller Medeiros
     * @constructor
     */
    function Signal() {
        /**
         * @type Array.<SignalBinding>
         * @private
         */
        this._bindings = [];
        this._prevParams = null;

        // enforce dispatch to aways work on same context (#47)
        var self = this;
        this.dispatch = function(){
            Signal.prototype.dispatch.apply(self, arguments);
        };
    }

    Signal.prototype = {

        /**
         * Signals Version Number
         * @type String
         * @const
         */
        VERSION : '1.0.0',

        /**
         * If Signal should keep record of previously dispatched parameters and
         * automatically execute listener during `add()`/`addOnce()` if Signal was
         * already dispatched before.
         * @type boolean
         */
        memorize : false,

        /**
         * @type boolean
         * @private
         */
        _shouldPropagate : true,

        /**
         * If Signal is active and should broadcast events.
         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
         * @type boolean
         */
        active : true,

        /**
         * @param {Function} listener
         * @param {boolean} isOnce
         * @param {Object} [listenerContext]
         * @param {Number} [priority]
         * @return {SignalBinding}
         * @private
         */
        _registerListener : function (listener, isOnce, listenerContext, priority) {

            var prevIndex = this._indexOfListener(listener, listenerContext),
                binding;

            if (prevIndex !== -1) {
                binding = this._bindings[prevIndex];
                if (binding.isOnce() !== isOnce) {
                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
                }
            } else {
                binding = new SignalBinding(this, listener, isOnce, listenerContext, priority);
                this._addBinding(binding);
            }

            if(this.memorize && this._prevParams){
                binding.execute(this._prevParams);
            }

            return binding;
        },

        /**
         * @param {SignalBinding} binding
         * @private
         */
        _addBinding : function (binding) {
            //simplified insertion sort
            var n = this._bindings.length;
            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
            this._bindings.splice(n + 1, 0, binding);
        },

        /**
         * @param {Function} listener
         * @return {number}
         * @private
         */
        _indexOfListener : function (listener, context) {
            var n = this._bindings.length,
                cur;
            while (n--) {
                cur = this._bindings[n];
                if (cur._listener === listener && cur.context === context) {
                    return n;
                }
            }
            return -1;
        },

        /**
         * Check if listener was attached to Signal.
         * @param {Function} listener
         * @param {Object} [context]
         * @return {boolean} if Signal has the specified listener.
         */
        has : function (listener, context) {
            return this._indexOfListener(listener, context) !== -1;
        },

        /**
         * Add a listener to the signal.
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        add : function (listener, listenerContext, priority) {
            validateListener(listener, 'add');
            return this._registerListener(listener, false, listenerContext, priority);
        },

        /**
         * Add listener to the signal that should be removed after first execution (will be executed only once).
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        addOnce : function (listener, listenerContext, priority) {
            validateListener(listener, 'addOnce');
            return this._registerListener(listener, true, listenerContext, priority);
        },

        /**
         * Remove a single listener from the dispatch queue.
         * @param {Function} listener Handler function that should be removed.
         * @param {Object} [context] Execution context (since you can add the same handler multiple times if executing in a different context).
         * @return {Function} Listener handler function.
         */
        remove : function (listener, context) {
            validateListener(listener, 'remove');

            var i = this._indexOfListener(listener, context);
            if (i !== -1) {
                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
                this._bindings.splice(i, 1);
            }
            return listener;
        },

        /**
         * Remove all listeners from the Signal.
         */
        removeAll : function () {
            var n = this._bindings.length;
            while (n--) {
                this._bindings[n]._destroy();
            }
            this._bindings.length = 0;
        },

        /**
         * @return {number} Number of listeners attached to the Signal.
         */
        getNumListeners : function () {
            return this._bindings.length;
        },

        /**
         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
         * @see Signal.prototype.disable
         */
        halt : function () {
            this._shouldPropagate = false;
        },

        /**
         * Dispatch/Broadcast Signal to all listeners added to the queue.
         * @param {...*} [params] Parameters that should be passed to each handler.
         */
        dispatch : function (params) {
            if (! this.active) {
                return;
            }

            var paramsArr = Array.prototype.slice.call(arguments),
                n = this._bindings.length,
                bindings;

            if (this.memorize) {
                this._prevParams = paramsArr;
            }

            if (! n) {
                //should come after memorize
                return;
            }

            bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
            //reverse loop since listeners with higher priority will be added at the end of the list
            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
        },

        /**
         * Forget memorized arguments.
         * @see Signal.memorize
         */
        forget : function(){
            this._prevParams = null;
        },

        /**
         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
         */
        dispose : function () {
            this.removeAll();
            delete this._bindings;
            delete this._prevParams;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        }

    };


    // Namespace -----------------------------------------------------
    //================================================================

    /**
     * Signals namespace
     * @namespace
     * @name signals
     */
    var signals = Signal;

    /**
     * Custom event broadcaster
     * @see Signal
     */
    // alias for backwards compatibility (see #gh-44)
    signals.Signal = Signal;



    //exports to multiple environments
    if(typeof define === 'function' && define.amd){ //AMD
        define(function () { return signals; });
    } else if (typeof module !== 'undefined' && module.exports){ //node
        module.exports = signals;
    } else { //browser
        //use string because of Google closure compiler ADVANCED_MODE
        /*jslint sub:true */
        global['signals'] = signals;
    }

}(this));

},{}],"ember-di":[function(require,module,exports){
    'use strict';

    var AST = {};
    

    var onSignalFn = function () {
        if (!arguments.length) {
            return this; // TODO: this might be an error or need a warning
        }

        var signalNames = arguments[0].constructor === Array ?
            arguments[0] :
            Array.prototype.slice.call(arguments);
        return new SignalAnnotation(this, signalNames);
    },

    instrumentFn = function AST$instrumentFn(inCtx) {
        var ctx = AST.IoC.getContext(inCtx),
        // this: the hash passed to ember extend/reopen/create
        key,
        beanName,
        propName,
        val,
        oldInit,
        oldDestroy,
        mySignals = [],
        signalNames,
        i,
        createFunc;

        this[AST.IoC._key + resolveContextName(inCtx) ] = ctx;

        this.getMessageBus = function () {
            return ctx.getMessageBus();
        };

        createFunc = function (inPropName, inBeanName) {
            return Ember.observer(inPropName, Ember.immediateObserver(inPropName, function () {
                AST.IoC.getContext(inCtx).onDelegatedCreation(inBeanName, this.get(inPropName));// that was arguments.callee
            }));
        };
        for (key in this) {
            if (this.hasOwnProperty(key)) {
                this.onDelegatedCreation = fdel(ctx, ctx.onDelegatedCreation);
                if (this[key] && this[key].constructor === InjectAnnotation) {
                    val = this[key].contextObjectName;
                    if (!this.hasOwnProperty(key) && key !== 'model') { // it seems like setting model to null would invalidate the binding
                        this[key] = null;
                    }
                    Ember.debug('Registering inject client for context \'' + inCtx + '\' value: ' + val);
                    this[key + 'Binding'] = AST.IoC.getContext(inCtx).registerInjectClient(val);
                    delete this[key];
                    continue;
                }


                if (this[key] && this[key].constructor === InjectorDelegateAnnotation) {
                    Ember.debug('Reminder: InjectorDelegate properties can only be declared at extend() or reopen() but not on create()');
                    Ember.debug('Registering injector delegate for context \'' + inCtx + '\' value: ' + key);

                    beanName = this[key].contextObjectName;
                    propName = key;
                    this[key + '_observer'] = createFunc(propName, beanName, this);
                    delete this[key];
                    continue;
                }
                if (this[key] && this[key].constructor === SignalAnnotation) {
                    signalNames = this[key].signalNames;
                    if (!signalNames || !signalNames.length) {
                        continue;
                    }
                    for (i = 0; i < signalNames.length; i++) {
                        Ember.debug('Registering signal handler for \'' + signalNames[i] + '\'');
                        ctx = AST.IoC.getContext(inCtx);
                        mySignals.push({
                            signal: ctx.getMessageBus()[signalNames[i]],
                            handler: this[key].handler
                        });
                    }
                    this[key] = this[key].handler;

                }
            }

        }

        if (mySignals.length > 0) {
            /*
             * Signals handlers are registered at init time and
             * unregistered at destroy time
             */
            if (this.hasOwnProperty('init')) {
                oldInit = this.init;
            }
            this.init = function () {
                if (!oldInit) {
                    // if the init function is present, it's  assumed
                    // to call this._super() correctly
                    this._super();
                }
                var that = this;
                mySignals.forEach(function (inSignalInfo) {
                    inSignalInfo.signal.add(inSignalInfo.handler, that);
                });
                if (oldInit) {
                    oldInit.apply(this, arguments);
                }
            };

            if (this.hasOwnProperty('init')) {
                oldDestroy = this.destroy;
            }

            this.destroy = function () {
                if (!oldDestroy) {
                    // if the destroy function is present, it's  assumed
                    // to call this._super() correctly
                    this._super();
                }
                var that = this;
                mySignals.forEach(function (inSignalInfo) {
                    inSignalInfo.signal.remove(inSignalInfo.handler, that);
                });
                if (oldDestroy) {
                    oldDestroy.apply(this, arguments);
                }
            };
        }

        return this;
    },
    SignalAnnotation =
        function SignalAnnotation$constructor(inHandler, inSignalNames) {
            this.handler = inHandler;
            this.signalNames = inSignalNames;
        },

    InjectAnnotation =
        function InjectAnnotation$constructor(inHandler, inContextObjectName) {
            this.handler = inHandler;
            this.contextObjectName = inContextObjectName;
        },

    InjectorDelegateAnnotation =
        function InjectorDelegateAnnotation$constructor(inHandler, inContextObjectName) {
            this.handler = inHandler;
            this.contextObjectName = inContextObjectName;
        },

    resolveClassPath = function (inPath) {
        var node = window,
        pathArray = inPath.split('.');
        while (pathArray.length) {
            node = node[pathArray.shiftObject()];
        }
        return node;
    },

    signals = require('signals'),
    fdel = function (inThis, inFn) { // function delegate util
        return function () {
            inFn.apply(inThis, Array.prototype.slice.call(arguments, 0));
        };
    },
    BaseEntry = function (inTargetClass) {
        this.getTargetClass = function () {
            return inTargetClass;
        };
        this.getFactory = function () {
            return defaultFactory;
        };
        this.init = function (inName, inContext) {
            this.getContext = function () {
                return inContext;
            };
            this.getName = function () {
                return inName;
            };
        };
        this.factory = function (inFactory) {
            Ember.assert(
                'Cannot set a factory to a null/undefined value.',
                inFactory instanceof Function);
            Ember.assert(
                'Cannot set a factory to a delegated entry ( no entry name available before init() is called )', !this.isDelegated());
            this.getFactory = function () {
                return inFactory;
            };
            return this;
        };
        this.isDelegated = function () {
            return false;
        };
        this.isDeferred = function () {
            return false;
        };
    },

    Singleton = function (inTargetClass) {

        BaseEntry.call(this, inTargetClass);
        this.delegated = function () {
            Ember.assert(
                'Calling delegated() to a singleton with custom factory doesn\'t make sense.',
                this.getFactory() === defaultFactory);
            this.isDelegated = function () {
                return true;
            };
            return this;
        };
        this.auto = function () {
            this.getFactory()(this);
            return this;
        };
        this.getInstanceDescriptor = function () {
            var that = this,
            outName = this.getName(),
            instance = this.getContext().get('values.' + this.getName());
            Ember.debug('Singleton instance for ' + this.getName() + '[ ' + this.getTargetClass() + '] in context \'' + this.getContext().getName() + '\' exists:' + (instance !== undefined));
            if (instance === undefined && !this.isDelegated()) {
                Ember.debug('calling factory');
                instance = this.getFactory()(this);
                if (instance instanceof DeferredCreation) {
                    instance.instanciate = function () {
                        return that.getFactory()(that);
                    };
                }
                this.getContext().set('values.' + outName, instance);
            }
            return {
                getName: function () {
                    return outName;
                },
                getInstance: function () {
                    return instance;
                }
            };
        };

    },

    Bean = function (inTargetClass) {
        BaseEntry.call(this, inTargetClass);
        this.getInstanceDescriptor = function () {
            var outName = this.getName() + '_' + Date.now(),
            outInstance = this.getFactory()(this);
            return {
                getInstance: function () {
                    return outInstance;
                },
                getName: function () {
                    return outName;
                }
            };
        };
    },

    DeferredCreation = function () {
    },

    /**
     *  default factory method for creating context objects
     *  TODO: add support for custom factories
     */
    defaultFactory = function (inEntry) {
        var tc = inEntry.getTargetClass();
        if (typeof tc === 'string') {
            tc = resolveClassPath(tc);
        }
        if (tc) {
            return tc.createRecord ?
                tc.createRecord() :
                tc.create();
        } else {
            return new DeferredCreation();
        }
    },

    resolveContextName = function (inOriginal) {
        return inOriginal || '_default';
    };


    AST.MessageBus = function () {
        this.addSignal = function (inSignalName) {
            Ember.assert(
                'addSignal only accepts a string parameter reppresenting the signal\'s name',
                typeof inSignalName === 'string');
            this[inSignalName] = new signals.Signal();
            return this[inSignalName];
        };

        this.addForward = function (inSignalName, inSourceSignal) {
            Ember.assert(
                'addForward needs two parameters: 1. a signal name for the current bus, 2. the signal to be forwarded. Found: ' + inSignalName + ', ' + inSourceSignal,
                typeof inSignalName === 'string' && inSourceSignal instanceof signals.Signal);
            var sig = this[inSignalName];
            if (!sig) {
                sig = this.addSignal(inSignalName);
            }
            inSourceSignal.add(function () {
                var args =  Array.prototype.slice.call(arguments);
                sig.dispatch.apply(this, args);
            });
        };
    };


    AST.ContextConfig = function (inConfig) {
        var messageBusAvailable_hook,
        _signals = [];
        this.messageBusAvailable = function (inMessageBus) {
            _signals.forEach(function (inSignalName) {
                inMessageBus.addSignal(inSignalName);
            });
            if (messageBusAvailable_hook) {
                messageBusAvailable_hook(inMessageBus);
            }
        };
        if (inConfig.messageBusAvailable) {
            Ember.assert(
                'AST.ContextConfig: \'messageBusAvailable\' config entry must be a function.',
                inConfig.messageBusAvailable.constructor === Function);
            messageBusAvailable_hook = inConfig.messageBusAvailable;
        }
        if (inConfig.signals) {
            Ember.assert(
                'AST.ContextConfig: \'signals\' config entry must be an array.',
                inConfig.signals.constructor === Array);
            inConfig.signals.forEach(function (inSignalName) {
                _signals.push(inSignalName);
            });
        }
    };

    AST.instrument = function (inTargetObject, inContextName) {
        return instrumentFn.call(inTargetObject, inContextName);
    };

    AST.inject = function (inInjectedObjectName, inFunction) {
        return new InjectAnnotation(inFunction, inInjectedObjectName);
    };

    AST.onSignal = function () {
        var args = Array.prototype.slice.call(arguments, 0),
        fn = args.pop();
        return onSignalFn.apply(fn, args);
    };

    AST.IoC = {
        contexts: {},

        _key: '_ember-di-' + (new Date()).getTime(),
        /**
         *  creates a new context object and with the provided hash and
         *  optional name.
         *  Args: ( entriesHash ) or ( contextName, entriesHash )
         */
        createContext: function () {
            var hash,
            msgBus,
            ctxName,
            conf,
            i, k,
            arg,
            args = Array.prototype.slice.call(arguments);

            for (i in args) {
                if (args.hasOwnProperty(i)) {
                    arg = args[i];
                    if (!ctxName && typeof arg === 'string') {
                        ctxName = arg;
                        continue;
                    } else if (!conf && arg instanceof AST.ContextConfig) {
                        conf = arg;
                        continue;
                    } else if (!hash && typeof arg === 'object') {
                        hash = arg;
                    }
                }
            }
            Ember.assert(
                'Context names must follow camel case standard. Found:' + ctxName, !ctxName || ctxName.toString().match(/^[a-z]\w*$/));

            ctxName = resolveContextName(ctxName);

            Ember.debug('Creating context: ' + ctxName);
            Ember.assert('Context ' + ctxName + ' already exists.', !this.contexts.hasOwnProperty(ctxName));
            msgBus = new AST.MessageBus();

            this.contexts[ctxName] = Ember.Object.extend({
                _messageBus: msgBus,

                getName: function AST$Context$getName() {
                    return ctxName;
                },
                /**
                 * to be called by the delegated instance factory upon instanciation
                 */
                onDelegatedCreation: function AST$Context$onDelegatedCreation(inKey, inValue) {
                    // this: the context instance
                    Ember.assert('onDelegatedCreation must be called with either one argument ' +
                        '(instance to be associated to a delegated Singleton) or two ' +
                        '(name and Singleton instance)', inKey !== null);
                    if (arguments.length === 1 && inKey !== null) {
                        var key,
                        obj = inKey,
                        objType = inKey.constructor;
                        for (key in this.entries) {
                            if (this.entries[key] instanceof Singleton && resolveClassPath(this.entries[key].getTargetClass()) === objType) {
                                this.set('values.' + key, obj);
                                Ember.debug('Delegated creation: ' + key);
                                return;
                            }
                        }
                        throw new Error('Cannot find a singleton of type ' + objType.toString() + ' for context delegated creation');
                    } else {
                        Ember.assert(
                            'Context ' + ctxName + ' does not have a Singleton entry with name ' + inKey,
                            this.entries.hasOwnProperty(inKey) && this.entries[inKey] instanceof Singleton);
                        Ember.debug('Delegated creation: ' + inKey);
                        this.set('values.' + inKey, inValue);
                    }
                },

                getObject: function AST$Context$getObject(inEntryName) {
                    if (!this.get('entries').hasOwnProperty(inEntryName)) {
                        return null;
                    }
                    var entry = this.get('entries')[inEntryName];
                    return entry.getInstanceDescriptor().getInstance();
                },

                getMessageBus: function AST$Context$getMessageBus() {
                    return this.get('_messageBus');
                },


                registerInjectClient: function AST$Context$registerInjectClient(inEntryKey) {
                    // this: the context instance
                    if (typeof inEntryKey === 'string' && /^[a-z]/.test(inEntryKey)) { // inject is by name
                        var ctxName = this.getName(), // checked
                        entry = AST.IoC.getContext(ctxName).entries[inEntryKey],
                        descriptor = entry.getInstanceDescriptor();
                        return Ember.Binding.oneWay(
                            AST.IoC._key + ctxName +
                            '.values.' +
                            descriptor.getName());
                    } else { // TODO: implement return by type
                        return null;
                    }
                },
                entries: hash,
                values: Ember.Object.create(),
                start: function () {
                    var key,
                    value,
                    values = this.get('values');
                    for (key in values) {
                        if (values.hasOwnProperty(key)) {
                            value = values.get(key);
                            if (value instanceof DeferredCreation) {
                                this.set('values.' + key, value.instanciate());
                            }
                        }
                    }
                }
            }).create();


            if (conf && conf.hasOwnProperty('messageBusAvailable')) {
                conf.messageBusAvailable
                    .call(this.contexts[ctxName], msgBus);
            }

            for (k in hash) {
                if (hash.hasOwnProperty(k)) {
                    Ember.assert(
                        'Context entry can only be created via the AST.IoC.singleton or AST.IoC.instance',
                        hash[k] instanceof Singleton || hash[k] instanceof Bean);
                    hash[k].init(k, this.contexts[ctxName]);
                }
            }

            return this.contexts[ctxName];
        },

        bean: function AST$IoC$bean(inClass) {// returns an instance of Bean
            Ember.debug('Creating Bean entry for class ' + inClass);
            return new Bean(inClass);
        },
        singleton: function AST$IoC$singleton(inClass) { // returns an instance of Singleton
            Ember.debug('Creating Singleton entry for class ' + inClass);
            return new Singleton(inClass);
        },
        getContext: function AST$IoC$getContext(inName) {
            var ctxName = resolveContextName(inName);
            return this.contexts.hasOwnProperty(ctxName) ? this.contexts[ctxName] : null;
        }


    };
    
    (function () {
        if (!window.ENV || window.ENV.EXTEND_PROTOTYPES !== false) {

            /*
             * This piece of code prevents conflicting prototype extensions from going unnoticed
             * A possible extension to this would be giving a set of keywords,
             * either a white or a blacklist to enable 'harmless' overrides
             * Ideally this code should be run very early in the application bootstrap
            */
            var originalDefineProperty = Object.defineProperty;

            Object.defineProperty = function (inProt, inName, inOptions) {
                if (Object.prototype[inName] !== (function () {})()) {
                    throw new Error('PROTOTYPE EXTENTION POTENTIAL FAILURE: "' + inName +
                        '" already defined for Object.prototype');
                }
                originalDefineProperty(inProt, inName, inOptions);
            };
            // =================================================================================

            Object.defineProperty(Function.prototype, 'onSignal', {
                value: onSignalFn,
                enumerable: false
            });

            Object.defineProperty(Function.prototype, 'inject', {
                value: function (inContextObjectName) {
                    return new InjectAnnotation(this, inContextObjectName);
                },
                enumerable: false
            });

            Object.defineProperty(Function.prototype, 'injectorDelegate', {
                value: function (inContextObjectName) {
                    console.log('injectorDelegate! ' + inContextObjectName);
                    return new InjectorDelegateAnnotation(this, inContextObjectName);
                },
                enumerable: false
            });
        
            Object.defineProperty(Object.prototype, 'ioc', {
                value: instrumentFn,
                enumerable: false
            });
        }
    })();

    exports.onSignal = AST.onSignal;
    exports.inject = AST.inject;
    exports.instrument = AST.instrument;
    exports.getContext = function() {
        return AST.IoC.getContext.apply( AST.IoC, Array.prototype.slice.call(arguments, 0));
    }
    exports.singleton = function() {
        return AST.IoC.singleton.apply( AST.IoC, Array.prototype.slice.call(arguments, 0));
    }
    exports.ContextConfig = AST.ContextConfig;
    exports.createContext = function() {
       return AST.IoC.createContext.apply( AST.IoC, Array.prototype.slice.call(arguments, 0));
    }



},{"signals":1}]},{},[]);
