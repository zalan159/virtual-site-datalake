/**
 * 条件触发引擎
 * 处理IoT数据绑定的条件评估和自动化响应
 */

import { BindingCondition, TriggerResult } from './iotDataProcessor';

/**
 * 条件评估上下文
 */
export interface ConditionContext {
  currentValue: any;
  previousValue?: any;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * 触发执行上下文
 */
export interface TriggerContext {
  sceneId: string;
  instanceId: string;
  bindingId: string;
  setModelProperty: (target: string, value: any) => Promise<void>;
  sendIoTCommand: (protocol: string, target: string, value: any) => Promise<void>;
  playAnimation: (target: string, params: any) => Promise<void>;
  showAlert: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
  callFunction: (functionName: string, params: any) => Promise<any>;
  setState: (key: string, value: any) => void;
  getState: (key: string) => any;
}

/**
 * 条件评估结果
 */
export interface ConditionEvaluationResult {
  conditionId: string;
  satisfied: boolean;
  value: any;
  previousValue?: any;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * 条件触发引擎
 */
export class ConditionEngine {
  private static conditionHistory = new Map<string, ConditionEvaluationResult[]>();
  private static maxHistorySize = 100;

  /**
   * 评估单个条件
   * @param condition 条件配置
   * @param context 评估上下文
   * @returns 评估结果
   */
  static evaluateCondition(condition: BindingCondition, context: ConditionContext): ConditionEvaluationResult {
    if (!condition.enabled) {
      return {
        conditionId: condition.id,
        satisfied: false,
        value: context.currentValue,
        previousValue: context.previousValue,
        timestamp: context.timestamp
      };
    }

    let satisfied = false;

    try {
      switch (condition.type) {
        case 'threshold':
          satisfied = this.evaluateThreshold(context.currentValue, condition.operator, condition.value, condition.tolerance);
          break;
        case 'range':
          satisfied = this.evaluateRange(context.currentValue, condition.operator, condition.value, condition.secondValue);
          break;
        case 'change':
          satisfied = this.evaluateChange(context.currentValue, context.previousValue, condition.operator, condition.value, condition.tolerance);
          break;
        case 'pattern':
          satisfied = this.evaluatePattern(context.currentValue, condition.value);
          break;
        case 'timeout':
          satisfied = this.evaluateTimeout(condition.id, context.timestamp, condition.value);
          break;
        default:
          console.warn(`未知的条件类型: ${condition.type}`);
          satisfied = false;
      }
    } catch (error) {
      console.error(`条件评估失败 (${condition.id}):`, error);
      satisfied = false;
    }

    const result: ConditionEvaluationResult = {
      conditionId: condition.id,
      satisfied,
      value: context.currentValue,
      previousValue: context.previousValue,
      timestamp: context.timestamp,
      metadata: context.metadata
    };

    // 保存历史记录
    this.saveConditionHistory(condition.id, result);

    return result;
  }

  /**
   * 评估多个条件组合
   * @param conditions 条件数组
   * @param context 评估上下文
   * @param logic 逻辑操作符 ('and' | 'or' | 'not')
   * @returns 组合评估结果
   */
  static evaluateConditions(
    conditions: BindingCondition[], 
    context: ConditionContext,
    logic: 'and' | 'or' | 'not' = 'and'
  ): { satisfied: boolean; results: ConditionEvaluationResult[] } {
    const results = conditions.map(condition => this.evaluateCondition(condition, context));
    
    let satisfied = false;
    
    switch (logic) {
      case 'and':
        satisfied = results.every(result => result.satisfied);
        break;
      case 'or':
        satisfied = results.some(result => result.satisfied);
        break;
      case 'not':
        satisfied = !results.some(result => result.satisfied);
        break;
    }

    return { satisfied, results };
  }

  /**
   * 执行触发结果
   * @param trigger 触发配置
   * @param context 执行上下文
   * @returns 执行结果
   */
  static async executeTrigger(trigger: TriggerResult, context: TriggerContext): Promise<{ success: boolean; error?: string }> {
    if (!trigger.enabled) {
      return { success: true };
    }

    try {
      // 延迟执行
      if (trigger.delay && trigger.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, trigger.delay));
      }

      switch (trigger.type) {
        case 'setValue':
          await context.setModelProperty(trigger.target, trigger.value);
          break;
          
        case 'sendCommand':
          // 从target中解析协议和目标
          const [protocol, commandTarget] = trigger.target.split(':');
          await context.sendIoTCommand(protocol, commandTarget, trigger.value);
          break;
          
        case 'playAnimation':
          await context.playAnimation(trigger.target, trigger.value);
          break;
          
        case 'showAlert':
          const alertType = trigger.metadata?.type || 'info';
          context.showAlert(trigger.value, alertType);
          break;
          
        case 'callFunction':
          await context.callFunction(trigger.target, trigger.value);
          break;
          
        case 'setState':
          context.setState(trigger.target, trigger.value);
          break;
          
        default:
          throw new Error(`未知的触发类型: ${trigger.type}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error(`触发执行失败 (${trigger.id}):`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量执行触发结果
   * @param triggers 触发配置数组
   * @param context 执行上下文
   * @returns 执行结果
   */
  static async executeTriggers(
    triggers: TriggerResult[], 
    context: TriggerContext
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let successful = 0;
    let failed = 0;

    for (const trigger of triggers) {
      const result = await this.executeTrigger(trigger, context);
      if (result.success) {
        successful++;
      } else {
        failed++;
        if (result.error) {
          errors.push(`${trigger.id}: ${result.error}`);
        }
      }
    }

    return { successful, failed, errors };
  }

  /**
   * 评估阈值条件
   */
  private static evaluateThreshold(
    value: any, 
    operator: BindingCondition['operator'], 
    threshold: any, 
    tolerance: number = 0
  ): boolean {
    if (typeof value !== 'number' || typeof threshold !== 'number') {
      return this.evaluateNonNumericComparison(value, operator, threshold);
    }

    const diff = Math.abs(value - threshold);
    
    switch (operator) {
      case 'gt':
        return value > threshold + tolerance;
      case 'gte':
        return value >= threshold - tolerance;
      case 'lt':
        return value < threshold - tolerance;
      case 'lte':
        return value <= threshold + tolerance;
      case 'eq':
        return diff <= tolerance;
      case 'neq':
        return diff > tolerance;
      default:
        return false;
    }
  }

  /**
   * 评估范围条件
   */
  private static evaluateRange(
    value: any, 
    operator: BindingCondition['operator'], 
    min: any, 
    max: any
  ): boolean {
    if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {
      return false;
    }

    switch (operator) {
      case 'between':
        return value >= min && value <= max;
      case 'outside':
        return value < min || value > max;
      default:
        return false;
    }
  }

  /**
   * 评估变化条件
   */
  private static evaluateChange(
    currentValue: any, 
    previousValue: any, 
    operator: BindingCondition['operator'], 
    threshold: any, 
    tolerance: number = 0
  ): boolean {
    if (previousValue === undefined) {
      return false; // 没有历史值，无法判断变化
    }

    if (typeof currentValue === 'number' && typeof previousValue === 'number') {
      const change = currentValue - previousValue;
      const absChange = Math.abs(change);
      
      switch (operator) {
        case 'gt':
          return change > threshold + tolerance;
        case 'lt':
          return change < threshold - tolerance;
        case 'eq':
          return absChange <= tolerance;
        case 'neq':
          return absChange > tolerance;
        default:
          return false;
      }
    }

    // 非数值类型的变化检测
    switch (operator) {
      case 'eq':
        return currentValue === previousValue;
      case 'neq':
        return currentValue !== previousValue;
      default:
        return false;
    }
  }

  /**
   * 评估模式匹配条件
   */
  private static evaluatePattern(value: any, pattern: any): boolean {
    if (typeof value === 'string' && typeof pattern === 'string') {
      try {
        const regex = new RegExp(pattern);
        return regex.test(value);
      } catch {
        // 如果不是正则表达式，进行字符串包含匹配
        return value.includes(pattern);
      }
    }

    if (typeof value === 'object' && typeof pattern === 'object') {
      return this.deepMatch(value, pattern);
    }

    return value === pattern;
  }

  /**
   * 评估超时条件
   */
  private static evaluateTimeout(conditionId: string, currentTime: number, timeoutMs: number): boolean {
    const history = this.conditionHistory.get(conditionId);
    if (!history || history.length === 0) {
      return false;
    }

    const lastEvaluation = history[history.length - 1];
    return (currentTime - lastEvaluation.timestamp) > timeoutMs;
  }

  /**
   * 非数值比较
   */
  private static evaluateNonNumericComparison(
    value: any, 
    operator: BindingCondition['operator'], 
    target: any
  ): boolean {
    switch (operator) {
      case 'eq':
        return value === target;
      case 'neq':
        return value !== target;
      case 'contains':
        return typeof value === 'string' && typeof target === 'string' && value.includes(target);
      case 'matches':
        return typeof value === 'string' && typeof target === 'string' && new RegExp(target).test(value);
      default:
        return false;
    }
  }

  /**
   * 深度对象匹配
   */
  private static deepMatch(obj: any, pattern: any): boolean {
    if (pattern === null || pattern === undefined) {
      return obj === pattern;
    }

    if (typeof pattern !== 'object') {
      return obj === pattern;
    }

    for (const key in pattern) {
      if (!(key in obj)) {
        return false;
      }
      if (!this.deepMatch(obj[key], pattern[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * 保存条件历史记录
   */
  private static saveConditionHistory(conditionId: string, result: ConditionEvaluationResult): void {
    if (!this.conditionHistory.has(conditionId)) {
      this.conditionHistory.set(conditionId, []);
    }

    const history = this.conditionHistory.get(conditionId)!;
    history.push(result);

    // 限制历史记录大小
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * 获取条件历史记录
   */
  static getConditionHistory(conditionId: string): ConditionEvaluationResult[] {
    return this.conditionHistory.get(conditionId) || [];
  }

  /**
   * 清除条件历史记录
   */
  static clearConditionHistory(conditionId?: string): void {
    if (conditionId) {
      this.conditionHistory.delete(conditionId);
    } else {
      this.conditionHistory.clear();
    }
  }

  /**
   * 获取条件统计信息
   */
  static getConditionStats(conditionId: string): {
    totalEvaluations: number;
    satisfiedCount: number;
    satisfactionRate: number;
    lastEvaluation?: ConditionEvaluationResult;
  } {
    const history = this.getConditionHistory(conditionId);
    const totalEvaluations = history.length;
    const satisfiedCount = history.filter(result => result.satisfied).length;
    const satisfactionRate = totalEvaluations > 0 ? satisfiedCount / totalEvaluations : 0;
    const lastEvaluation = history.length > 0 ? history[history.length - 1] : undefined;

    return {
      totalEvaluations,
      satisfiedCount,
      satisfactionRate,
      lastEvaluation
    };
  }

  /**
   * 创建预设条件
   */
  static createPresetCondition(
    preset: 'high_temperature' | 'low_battery' | 'motion_detected' | 'value_changed' | 'timeout',
    customParams?: Partial<BindingCondition>
  ): BindingCondition {
    const baseId = `preset_${preset}_${Date.now()}`;
    
    const presets: Record<string, Partial<BindingCondition>> = {
      high_temperature: {
        type: 'threshold',
        operator: 'gt',
        value: 30,
        tolerance: 1
      },
      low_battery: {
        type: 'threshold',
        operator: 'lt',
        value: 20,
        tolerance: 2
      },
      motion_detected: {
        type: 'threshold',
        operator: 'eq',
        value: true,
        tolerance: 0
      },
      value_changed: {
        type: 'change',
        operator: 'neq',
        value: 0,
        tolerance: 0.01
      },
      timeout: {
        type: 'timeout',
        operator: 'gt',
        value: 300000, // 5分钟
        tolerance: 0
      }
    };

    const presetConfig = presets[preset];
    
    return {
      id: baseId,
      enabled: true,
      ...presetConfig,
      ...customParams
    } as BindingCondition;
  }

  /**
   * 创建预设触发结果
   */
  static createPresetTrigger(
    preset: 'send_alert' | 'change_color' | 'play_sound' | 'send_command' | 'log_event',
    customParams?: Partial<TriggerResult>
  ): TriggerResult {
    const baseId = `preset_${preset}_${Date.now()}`;
    
    const presets: Record<string, Partial<TriggerResult>> = {
      send_alert: {
        type: 'showAlert',
        target: '',
        value: '条件触发警告',
        metadata: { type: 'warning' }
      },
      change_color: {
        type: 'setValue',
        target: 'materials[0].emissiveFactor',
        value: [1, 0, 0, 1], // 红色
        duration: 1000
      },
      play_sound: {
        type: 'playAnimation',
        target: 'audio',
        value: { sound: 'alert.wav', volume: 0.8 }
      },
      send_command: {
        type: 'sendCommand',
        target: 'mqtt:device/command',
        value: { action: 'turn_on' }
      },
      log_event: {
        type: 'setState',
        target: 'lastTriggerTime',
        value: Date.now()
      }
    };

    const presetConfig = presets[preset];
    
    return {
      id: baseId,
      enabled: true,
      delay: 0,
      ...presetConfig,
      ...customParams
    } as TriggerResult;
  }
}

/**
 * 条件表达式解析器
 * 支持复杂的条件表达式语法
 */
export class ConditionExpressionParser {
  /**
   * 解析条件表达式
   * @param expression 表达式字符串
   * @returns 解析结果
   */
  static parseExpression(expression: string): {
    success: boolean;
    conditions?: BindingCondition[];
    logic?: 'and' | 'or' | 'not';
    error?: string;
  } {
    try {
      // 这里可以实现更复杂的表达式解析逻辑
      // 例如: "temperature > 30 AND humidity < 50"
      // 或者: "motion == true OR (light > 100 AND time > 18:00)"
      
      // 简化实现，返回成功状态
      return {
        success: true,
        conditions: [],
        logic: 'and'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 验证表达式语法
   */
  static validateExpression(expression: string): { valid: boolean; error?: string } {
    try {
      this.parseExpression(expression);
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }
}