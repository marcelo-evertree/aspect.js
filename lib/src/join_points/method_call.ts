import { Precondition, JoinPoint } from '../core/join_point';
import { Advice } from '../core/advice';
import { Pointcut } from '../core/pointcut';
import { AspectRegistry, Targets, Aspect } from '../core/aspect';
import { MethodSelector } from './selectors';
import { MethodPrecondition } from './preconditions';

const BLACK_LIST = ['constructor'];

export class MethodCallJoinPoint extends JoinPoint {
  public getTarget(fn: Function): any {
    return fn.prototype;
  }

  public match(target: Function): any[] {
    let keys = Object.getOwnPropertyNames(target.prototype);
    keys = keys.filter(key => {
      return BLACK_LIST.indexOf(key) < 0;
    });
    const res = keys
      .map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(target.prototype, key);
        if (
          this.precondition.assert({
            classDefinition: target,
            methodName: key
          }) &&
          typeof descriptor.value === 'function'
        ) {
          return key;
        }
        return false;
      })
      .filter(val => !!val);
    return res;
  }

  protected woveTarget(proto: { [key: string]: any }, key: string, advice: Advice, woveMetadata: any) {
    const className = proto.constructor.name;
    const bak = proto[key];
    const self = this;
    proto[key] = function() {
      const metadata = self.getMetadata(className, key, bak, arguments, this, woveMetadata);
      return advice.wove(bak, metadata);
    };
    proto[key].__woven__ = true;
  }
}

export function makeMethodCallAdviceDecorator(constr: any) {
  return function(...selectors: MethodSelector[]): MethodDecorator {
    return function<T>(target: Object, prop: symbol | string, descriptor: TypedPropertyDescriptor<T>) {
      const joinpoints = selectors.map(selector => {
        return new MethodCallJoinPoint(new MethodPrecondition(selector));
      });
      const pointcut = new Pointcut();
      pointcut.advice = <Advice>new constr(target, descriptor.value);
      pointcut.joinPoints = joinpoints;
      const aspectName = target.constructor.name;
      const aspect = AspectRegistry.get(aspectName) || new Aspect();
      aspect.pointcuts.push(pointcut);
      AspectRegistry.set(aspectName, aspect);
      // For lazy loading
      Targets.forEach(({ target, config }) => aspect.wove(target, config));
      return target;
    };
  };
}

/**
 * Kept for backward compability only.
 * Use {@link MethodCallJoinPoint} instead.
 *
 * @deprecated renamed to MethodCallJoinPoint
 * @see MethodCallJoinPoint
 */
export abstract class MethodCallJointPoint extends MethodCallJoinPoint {
  constructor(precondition: Precondition) {
    super(precondition);
  }
}
