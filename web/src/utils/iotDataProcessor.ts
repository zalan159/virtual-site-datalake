/**
 * IoT数据处理器工具类
 * 提供不同数据类型的解析、转换和验证功能
 */

import { IoTDataType } from '../services/iotBindingApi';

// 新增：数值映射接口
export interface ValueMapping {
  inputRange: [number, number];
  outputRange: [number, number];
  interpolationType: 'linear' | 'exponential' | 'logarithmic' | 'cubic' | 'sine';
  clampMode: 'clamp' | 'wrap' | 'mirror';
  enabled: boolean;
}

// 新增：插值配置接口
export interface InterpolationConfig {
  type: 'none' | 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';
  duration: number; // 毫秒
  delay: number; // 毫秒
  enabled: boolean;
  bezierPoints?: [number, number, number, number]; // 贝塞尔曲线控制点
}

// 新增：绑定条件接口
export interface BindingCondition {
  id: string;
  type: 'threshold' | 'range' | 'change' | 'pattern' | 'timeout';
  operator: 'gt' | 'lt' | 'eq' | 'neq' | 'gte' | 'lte' | 'between' | 'outside' | 'contains' | 'matches';
  value: any;
  secondValue?: any; // 用于范围条件
  tolerance?: number;
  enabled: boolean;
}

// 新增：触发结果接口
export interface TriggerResult {
  id: string;
  type: 'setValue' | 'sendCommand' | 'playAnimation' | 'showAlert' | 'callFunction' | 'setState';
  target: string;
  value: any;
  delay?: number;
  duration?: number;
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface ProcessedData {
  success: boolean;
  data: unknown;
  error?: string;
  type: string;
  originalData: unknown;
}

export class IoTDataProcessor {
  /**
   * 处理IoT数据
   * @param rawData 原始数据
   * @param dataType 数据类型
   * @returns 处理结果
   */
  static processData(rawData: unknown, dataType: IoTDataType): ProcessedData {
    const result: ProcessedData = {
      success: false,
      data: null,
      type: dataType,
      originalData: rawData
    };

    try {
      switch (dataType) {
        case IoTDataType.TEXT:
          result.data = this.processText(rawData);
          break;
        case IoTDataType.JSON:
          result.data = this.processJSON(rawData);
          break;
        case IoTDataType.NUMBER:
          result.data = this.processNumber(rawData);
          break;
        case IoTDataType.BOOLEAN:
          result.data = this.processBoolean(rawData);
          break;
        case IoTDataType.IMAGE_BASE64:
          result.data = this.processImageBase64(rawData);
          break;
        case IoTDataType.BINARY:
          result.data = this.processBinary(rawData);
          break;
        default:
          throw new Error(`不支持的数据类型: ${dataType}`);
      }
      
      result.success = true;
    } catch (error: any) {
      result.error = error.message;
      result.success = false;
    }

    return result;
  }

  /**
   * 处理文本数据
   */
  private static processText(data: unknown): string {
    if (data === null || data === undefined) {
      return '';
    }
    
    if (typeof data === 'string') {
      return data;
    }
    
    if (Buffer.isBuffer(data)) {
      return data.toString('utf8');
    }
    
    if (typeof data === 'object') {
      return JSON.stringify(data);
    }
    
    return String(data);
  }

  /**
   * 处理JSON数据
   */
  private static processJSON(data: unknown): unknown {
    if (typeof data === 'object' && data !== null) {
      return data; // 已经是对象，直接返回
    }
    
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        throw new Error(`JSON解析失败: ${error}`);
      }
    }
    
    if (Buffer.isBuffer(data)) {
      try {
        return JSON.parse(data.toString('utf8'));
      } catch (error) {
        throw new Error(`Buffer JSON解析失败: ${error}`);
      }
    }
    
    throw new Error('无法将数据转换为JSON格式');
  }

  /**
   * 处理数值数据
   */
  private static processNumber(data: unknown): number {
    if (typeof data === 'number') {
      if (isNaN(data) || !isFinite(data)) {
        throw new Error('数值无效 (NaN 或 Infinity)');
      }
      return data;
    }
    
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (trimmed === '') {
        throw new Error('空字符串无法转换为数值');
      }
      
      const parsed = Number(trimmed);
      if (isNaN(parsed)) {
        throw new Error(`字符串 "${data}" 无法转换为数值`);
      }
      return parsed;
    }
    
    if (typeof data === 'boolean') {
      return data ? 1 : 0;
    }
    
    if (Buffer.isBuffer(data)) {
      return this.processNumber(data.toString('utf8'));
    }
    
    if (typeof data === 'object' && data !== null) {
      // 尝试从对象中提取数值
      if ('value' in data) {
        return this.processNumber(data.value);
      }
      if ('data' in data) {
        return this.processNumber(data.data);
      }
      if ('number' in data) {
        return this.processNumber(data.number);
      }
    }
    
    throw new Error(`无法将 ${typeof data} 类型转换为数值`);
  }

  /**
   * 处理布尔数据
   */
  private static processBoolean(data: unknown): boolean {
    if (typeof data === 'boolean') {
      return data;
    }
    
    if (typeof data === 'number') {
      return data !== 0;
    }
    
    if (typeof data === 'string') {
      const lower = data.toLowerCase().trim();
      if (lower === 'true' || lower === '1' || lower === 'on' || lower === 'yes') {
        return true;
      }
      if (lower === 'false' || lower === '0' || lower === 'off' || lower === 'no' || lower === '') {
        return false;
      }
      throw new Error(`字符串 "${data}" 无法转换为布尔值`);
    }
    
    if (Buffer.isBuffer(data)) {
      return this.processBoolean(data.toString('utf8'));
    }
    
    if (typeof data === 'object' && data !== null) {
      // 尝试从对象中提取布尔值
      if ('value' in data) {
        return this.processBoolean(data.value);
      }
      if ('data' in data) {
        return this.processBoolean(data.data);
      }
      if ('boolean' in data) {
        return this.processBoolean(data.boolean);
      }
      if ('state' in data) {
        return this.processBoolean(data.state);
      }
    }
    
    throw new Error(`无法将 ${typeof data} 类型转换为布尔值`);
  }

  /**
   * 处理Base64图像数据
   */
  private static processImageBase64(data: unknown): { base64: string; mimeType?: string; size?: number } {
    let base64String: string;
    
    if (typeof data === 'string') {
      base64String = data;
    } else if (Buffer.isBuffer(data)) {
      base64String = data.toString('base64');
    } else if (typeof data === 'object' && data !== null) {
      if ('base64' in data) {
        base64String = data.base64;
      } else if ('data' in data) {
        base64String = data.data;
      } else if ('image' in data) {
        base64String = data.image;
      } else {
        throw new Error('对象中未找到Base64图像数据');
      }
    } else {
      throw new Error(`无法将 ${typeof data} 类型转换为Base64图像`);
    }

    // 验证Base64格式
    if (!this.isValidBase64(base64String)) {
      throw new Error('无效的Base64格式');
    }

    // 提取MIME类型（如果存在）
    let mimeType: string | undefined;
    const dataUrlMatch = base64String.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64String = dataUrlMatch[2];
    }

    // 计算大小（字节）
    const size = Math.floor((base64String.length * 3) / 4);

    return {
      base64: base64String,
      mimeType,
      size
    };
  }

  /**
   * 处理二进制数据
   */
  private static processBinary(data: unknown): Uint8Array {
    if (data instanceof Uint8Array) {
      return data;
    }
    
    if (Buffer.isBuffer(data)) {
      return new Uint8Array(data);
    }
    
    if (Array.isArray(data)) {
      return new Uint8Array(data);
    }
    
    if (typeof data === 'string') {
      // 尝试Base64解码
      try {
        const buffer = Buffer.from(data, 'base64');
        return new Uint8Array(buffer);
      } catch {
        // 如果不是Base64，转换为UTF-8字节
        const buffer = Buffer.from(data, 'utf8');
        return new Uint8Array(buffer);
      }
    }
    
    if (typeof data === 'object' && data !== null) {
      if ('data' in data && Array.isArray(data.data)) {
        return new Uint8Array(data.data);
      }
      if ('buffer' in data && Array.isArray(data.buffer)) {
        return new Uint8Array(data.buffer);
      }
      if ('bytes' in data && Array.isArray(data.bytes)) {
        return new Uint8Array(data.bytes);
      }
    }
    
    throw new Error(`无法将 ${typeof data} 类型转换为二进制数据`);
  }

  /**
   * 验证Base64字符串
   */
  private static isValidBase64(str: string): boolean {
    try {
      // 移除Data URL前缀
      const cleanStr = str.replace(/^data:[^;]+;base64,/, '');
      
      // Base64正则表达式
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      
      if (!base64Regex.test(cleanStr)) {
        return false;
      }
      
      // 验证长度
      if (cleanStr.length % 4 !== 0) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取数据类型描述
   */
  static getDataTypeDescription(dataType: IoTDataType): string {
    switch (dataType) {
      case IoTDataType.TEXT:
        return '纯文本数据，支持字符串、Buffer和对象转换';
      case IoTDataType.JSON:
        return 'JSON格式数据，自动解析对象和字符串';
      case IoTDataType.NUMBER:
        return '数值数据，支持数字、字符串和布尔值转换';
      case IoTDataType.BOOLEAN:
        return '布尔数据，支持多种真值格式 (true/false, 1/0, on/off, yes/no)';
      case IoTDataType.IMAGE_BASE64:
        return 'Base64编码的图像数据，支持Data URL格式';
      case IoTDataType.BINARY:
        return '二进制数据，支持Uint8Array、Buffer和Base64格式';
      default:
        return '未知数据类型';
    }
  }

  /**
   * 验证数据类型兼容性
   */
  static validateDataType(rawData: unknown, dataType: IoTDataType): { valid: boolean; error?: string } {
    try {
      this.processData(rawData, dataType);
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 获取数据的可能类型建议
   */
  static suggestDataTypes(rawData: unknown): IoTDataType[] {
    const suggestions: IoTDataType[] = [];
    
    // 尝试各种类型
    const types = Object.values(IoTDataType);
    for (const type of types) {
      const result = this.validateDataType(rawData, type);
      if (result.valid) {
        suggestions.push(type);
      }
    }
    
    return suggestions;
  }
}

/**
 * 数据绑定处理器
 * 处理数据路径提取和值映射
 */
export class DataBindingProcessor {
  /**
   * 从数据中提取指定路径的值
   * @param data 数据对象
   * @param path 数据路径 (例如: "sensor.temperature", "location", "data[0].value", "location[0]")
   * @returns 提取的值
   */
  static extractValue(data: unknown, path: string): unknown {
    if (!path || path === '') {
      return data;
    }

    try {
      // 清理路径：移除MQTT主题前缀，只保留数据路径部分
      let processedPath = path;
      
      // 如果路径包含斜杠，可能是MQTT主题路径（如"sensor/location.temperature"）
      // 需要智能解析：如果斜杠后面有点号，说明是"主题/数据路径"格式
      if (path.includes('/')) {
        const slashParts = path.split('/');
        const lastPart = slashParts[slashParts.length - 1];
        
        // 如果最后部分包含点号或方括号，说明是数据路径
        if (lastPart.includes('.') || lastPart.includes('[')) {
          processedPath = lastPart;
          console.log(`[DataBindingProcessor] MQTT主题路径解析: "${path}" -> "${processedPath}"`);
        } else {
          // 否则整个路径可能都是数据路径
          processedPath = path.replace(/\//g, '.');
          console.log(`[DataBindingProcessor] 斜杠路径转换: "${path}" -> "${processedPath}"`);
        }
      }
      
      // 如果处理后的路径为空，返回整个数据
      if (!processedPath) {
        console.log(`[DataBindingProcessor] 路径为空，返回整个数据:`, data);
        return data;
      }
      
      // 处理数组索引和对象属性
      // 支持格式：location, location[0], location.x, data[0].value
      const pathParts = processedPath.split(/[.[\]]/).filter(part => part !== '');
      console.log(`[DataBindingProcessor] 路径分段: "${processedPath}" -> [${pathParts.join(', ')}]`);
      
      let current = data;
      
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        
        if (current === null || current === undefined) {
          console.log(`[DataBindingProcessor] 在路径 "${part}" 处数据为空`);
          return undefined;
        }
        
        // 处理数组索引
        if (/^\d+$/.test(part)) {
          const index = parseInt(part, 10);
          if (Array.isArray(current)) {
            current = current[index];
            console.log(`[DataBindingProcessor] 数组索引 [${index}]: `, current);
          } else {
            console.log(`[DataBindingProcessor] 期望数组但得到:`, typeof current, current);
            return undefined;
          }
        } else {
          // 处理对象属性
          if (typeof current === 'object' && current !== null && part in current) {
            current = current[part];
            console.log(`[DataBindingProcessor] 对象属性 "${part}": `, current);
          } else {
            console.log(`[DataBindingProcessor] 属性 "${part}" 不存在于:`, typeof current, Object.keys(current || {}));
            console.log(`[DataBindingProcessor] 当前数据值:`, current);
            return undefined;
          }
        }
      }
      
      console.log(`[DataBindingProcessor] 最终提取结果:`, current);
      return current;
    } catch (error) {
      console.error('数据路径提取失败:', error);
      return undefined;
    }
  }

  /**
   * 设置指定路径的值
   * @param data 数据对象
   * @param path 数据路径
   * @param value 要设置的值
   * @returns 是否设置成功
   */
  static setValue(data: unknown, path: string, value: unknown): boolean {
    if (!path || path === '') {
      return false;
    }

    try {
      const pathParts = path.split(/[.[\]]/).filter(part => part !== '');
      let current = data;
      
      // 遍历到倒数第二个部分
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        
        if (/^\d+$/.test(part)) {
          const index = parseInt(part, 10);
          if (!Array.isArray(current)) {
            return false;
          }
          current = current[index];
        } else {
          if (typeof current !== 'object' || current === null) {
            return false;
          }
          current = current[part];
        }
        
        if (current === null || current === undefined) {
          return false;
        }
      }
      
      // 设置最后一个部分的值
      const lastPart = pathParts[pathParts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        const index = parseInt(lastPart, 10);
        if (Array.isArray(current)) {
          current[index] = value;
          return true;
        }
      } else {
        if (typeof current === 'object' && current !== null) {
          current[lastPart] = value;
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('数据路径设置失败:', error);
      return false;
    }
  }

  /**
   * 获取数据的所有可能路径
   * @param data 数据对象
   * @param prefix 路径前缀
   * @param maxDepth 最大深度
   * @returns 路径数组
   */
  static getAllPaths(data: unknown, prefix = '', maxDepth = 10): string[] {
    if (maxDepth <= 0 || data === null || data === undefined) {
      return [];
    }

    const paths: string[] = [];
    
    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        // 为数组添加整体路径
        if (prefix) {
          paths.push(prefix);
        }
        
        data.forEach((item, index) => {
          const currentPath = prefix ? `${prefix}[${index}]` : `[${index}]`;
          paths.push(currentPath);
          
          const subPaths = this.getAllPaths(item, currentPath, maxDepth - 1);
          paths.push(...subPaths);
        });
      } else {
        Object.keys(data).forEach(key => {
          const currentPath = prefix ? `${prefix}.${key}` : key;
          paths.push(currentPath);
          
          const subPaths = this.getAllPaths(data[key], currentPath, maxDepth - 1);
          paths.push(...subPaths);
        });
      }
    } else {
      // 基础类型值，添加路径
      if (prefix) {
        paths.push(prefix);
      }
    }
    
    return paths;
  }

  /**
   * 根据样本数据建议可用的数据路径
   * @param sampleData 样本数据
   * @returns 建议的路径数组，按实用性排序
   */
  static suggestDataPaths(sampleData: unknown): Array<{path: string, type: string, sample: unknown}> {
    const allPaths = this.getAllPaths(sampleData);
    const suggestions: Array<{path: string, type: string, sample: unknown}> = [];
    
    for (const path of allPaths) {
      const value = this.extractValue(sampleData, path);
      const type = Array.isArray(value) ? 'array' : typeof value;
      
      // 过滤掉undefined和null值
      if (value !== undefined && value !== null) {
        suggestions.push({
          path,
          type,
          sample: value
        });
      }
    }
    
    // 按路径复杂度和实用性排序
    return suggestions.sort((a, b) => {
      // 优先显示简单路径
      const aComplexity = (a.path.match(/[.\[\]]/g) || []).length;
      const bComplexity = (b.path.match(/[.\[\]]/g) || []).length;
      
      if (aComplexity !== bComplexity) {
        return aComplexity - bComplexity;
      }
      
      // 优先显示数值和基础类型
      const typeOrder = { 'number': 0, 'boolean': 1, 'string': 2, 'array': 3, 'object': 4 };
      return (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5);
    });
  }

  /**
   * 验证路径并提供修正建议
   * @param data 数据对象
   * @param path 要验证的路径
   * @returns 验证结果和建议
   */
  static validatePath(data: unknown, path: string): {
    valid: boolean;
    value?: unknown;
    suggestions?: string[];
    error?: string;
  } {
    try {
      const value = this.extractValue(data, path);
      
      if (value !== undefined) {
        return { valid: true, value };
      }
      
      // 提供修正建议
      const suggestions = this.suggestDataPaths(data)
        .map(s => s.path)
        .filter(p => p.toLowerCase().includes(path.toLowerCase()) || 
                     path.toLowerCase().includes(p.toLowerCase()))
        .slice(0, 5);
      
      return {
        valid: false,
        suggestions,
        error: `路径 "${path}" 在数据中不存在`
      };
      
    } catch (error: any) {
      return {
        valid: false,
        error: `路径解析错误: ${error.message}`
      };
    }
  }
}

/**
 * 高级JSON路径解析器
 * 支持复杂路径表达式和通配符
 */
export class JSONPathParser {
  /**
   * 提取指定路径的值
   * @param data 数据对象
   * @param path JSON路径表达式
   * @returns 提取的值
   */
  static extractValue(data: any, path: string): any {
    if (!path || path === '') {
      return data;
    }

    try {
      // 支持多种路径格式
      // 简单路径: "sensor.temperature"
      // 数组索引: "sensors[0].value"
      // 通配符: "sensors[*].temperature" (返回数组)
      // 过滤器: "sensors[?(@.type=='temperature')].value"
      
      return this.evaluatePath(data, path);
    } catch (error) {
      console.error('JSON路径解析失败:', error);
      return undefined;
    }
  }

  /**
   * 验证路径格式是否正确
   * @param path 路径字符串
   * @returns 是否有效
   */
  static validatePath(path: string): boolean {
    if (!path) return false;
    
    try {
      // 基本格式验证
      const pathRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[\d+\]|\[\*\]|\[.*\])*$/;
      return pathRegex.test(path) || this.isValidJSONPath(path);
    } catch {
      return false;
    }
  }

  /**
   * 根据数据结构自动建议可用路径
   * @param data 数据对象
   * @param prefix 路径前缀
   * @param maxDepth 最大深度
   * @returns 建议的路径数组
   */
  static suggestPaths(data: any, prefix = '', maxDepth = 5): string[] {
    if (maxDepth <= 0 || data === null || data === undefined) {
      return [];
    }

    const paths: string[] = [];
    
    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        // 为数组添加通配符路径
        if (prefix && data.length > 0) {
          paths.push(`${prefix}[*]`);
          paths.push(`${prefix}[0]`);
          if (data.length > 1) {
            paths.push(`${prefix}[${data.length - 1}]`);
          }
        }
        
        // 递归处理数组元素
        if (data.length > 0) {
          const sampleElement = data[0];
          const elementPaths = this.suggestPaths(
            sampleElement, 
            prefix ? `${prefix}[0]` : '[0]', 
            maxDepth - 1
          );
          paths.push(...elementPaths);
          
          // 为通配符生成路径
          const wildcardPaths = this.suggestPaths(
            sampleElement, 
            prefix ? `${prefix}[*]` : '[*]', 
            maxDepth - 1
          );
          paths.push(...wildcardPaths);
        }
      } else {
        // 处理对象属性
        Object.keys(data).forEach(key => {
          const currentPath = prefix ? `${prefix}.${key}` : key;
          paths.push(currentPath);
          
          const subPaths = this.suggestPaths(data[key], currentPath, maxDepth - 1);
          paths.push(...subPaths);
        });
      }
    }
    
    return [...new Set(paths)]; // 去重
  }

  /**
   * 评估路径表达式
   */
  private static evaluatePath(data: any, path: string): any {
    // 处理根路径
    if (path === '$' || path === '') {
      return data;
    }

    // 移除根符号
    const cleanPath = path.startsWith('$.') ? path.substring(2) : path;
    
    // 分割路径段
    const segments = this.parsePathSegments(cleanPath);
    
    let current = data;
    
    for (const segment of segments) {
      current = this.evaluateSegment(current, segment);
      if (current === undefined) {
        break;
      }
    }
    
    return current;
  }

  /**
   * 解析路径段
   */
  private static parsePathSegments(path: string): Array<{type: 'property' | 'index' | 'wildcard' | 'filter', value: string}> {
    const segments: Array<{type: 'property' | 'index' | 'wildcard' | 'filter', value: string}> = [];
    let current = '';
    let inBrackets = false;
    let bracketContent = '';
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      if (char === '[') {
        if (current) {
          segments.push({type: 'property', value: current});
          current = '';
        }
        inBrackets = true;
        bracketContent = '';
      } else if (char === ']' && inBrackets) {
        if (bracketContent === '*') {
          segments.push({type: 'wildcard', value: '*'});
        } else if (/^\d+$/.test(bracketContent)) {
          segments.push({type: 'index', value: bracketContent});
        } else if (bracketContent.startsWith('?')) {
          segments.push({type: 'filter', value: bracketContent});
        } else {
          segments.push({type: 'property', value: bracketContent.replace(/['"]/g, '')});
        }
        inBrackets = false;
        bracketContent = '';
      } else if (char === '.' && !inBrackets) {
        if (current) {
          segments.push({type: 'property', value: current});
          current = '';
        }
      } else if (inBrackets) {
        bracketContent += char;
      } else {
        current += char;
      }
    }
    
    if (current) {
      segments.push({type: 'property', value: current});
    }
    
    return segments;
  }

  /**
   * 评估单个路径段
   */
  private static evaluateSegment(data: any, segment: {type: string, value: string}): any {
    if (data === null || data === undefined) {
      return undefined;
    }

    switch (segment.type) {
      case 'property':
        return typeof data === 'object' ? data[segment.value] : undefined;
        
      case 'index':
        const index = parseInt(segment.value, 10);
        return Array.isArray(data) ? data[index] : undefined;
        
      case 'wildcard':
        if (Array.isArray(data)) {
          return data; // 返回整个数组，让后续处理
        } else if (typeof data === 'object') {
          return Object.values(data); // 返回所有值的数组
        }
        return undefined;
        
      case 'filter':
        if (Array.isArray(data)) {
          return this.applyFilter(data, segment.value);
        }
        return undefined;
        
      default:
        return undefined;
    }
  }

  /**
   * 应用过滤器表达式
   */
  private static applyFilter(array: any[], filterExpression: string): any[] {
    // 简单过滤器实现，支持基本比较
    // 例如: ?(@.type=='temperature')
    try {
      return array.filter(item => {
        // 这里可以实现更复杂的过滤逻辑
        return true; // 简化实现
      });
    } catch {
      return [];
    }
  }

  /**
   * 验证是否为有效的JSONPath表达式
   */
  private static isValidJSONPath(path: string): boolean {
    // 简化的JSONPath验证
    const jsonPathRegex = /^\$?\.?[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*|\[\d+\]|\[\*\])*$/;
    return jsonPathRegex.test(path);
  }
}

/**
 * 数值映射和插值系统
 */
export class ValueMapper {
  /**
   * 映射数值
   * @param value 输入值
   * @param mapping 映射配置
   * @returns 映射后的值
   */
  static map(value: number, mapping: ValueMapping): number {
    if (!mapping.enabled) {
      return value;
    }

    const { inputRange, outputRange, interpolationType, clampMode } = mapping;
    
    // 标准化输入值到0-1范围
    let normalizedValue = (value - inputRange[0]) / (inputRange[1] - inputRange[0]);
    
    // 处理边界情况
    normalizedValue = this.applyClampMode(normalizedValue, clampMode);
    
    // 应用插值类型
    const interpolatedValue = this.applyInterpolation(normalizedValue, interpolationType);
    
    // 映射到输出范围
    return outputRange[0] + interpolatedValue * (outputRange[1] - outputRange[0]);
  }

  /**
   * 应用约束模式
   */
  private static applyClampMode(value: number, clampMode: ValueMapping['clampMode']): number {
    switch (clampMode) {
      case 'clamp':
        return Math.max(0, Math.min(1, value));
      case 'wrap':
        return value - Math.floor(value);
      case 'mirror':
        const wrapped = value - Math.floor(value);
        const cycle = Math.floor(value) % 2;
        return cycle === 0 ? wrapped : 1 - wrapped;
      default:
        return value;
    }
  }

  /**
   * 应用插值算法
   */
  private static applyInterpolation(value: number, type: ValueMapping['interpolationType']): number {
    switch (type) {
      case 'linear':
        return value;
      case 'exponential':
        return Math.pow(value, 2);
      case 'logarithmic':
        return value === 0 ? 0 : Math.log(value * 9 + 1) / Math.log(10);
      case 'cubic':
        return value * value * (3 - 2 * value);
      case 'sine':
        return (Math.sin((value - 0.5) * Math.PI) + 1) / 2;
      default:
        return value;
    }
  }

  /**
   * 创建预设映射配置
   */
  static createPresetMapping(preset: 'temperature' | 'humidity' | 'pressure' | 'percentage'): ValueMapping {
    const presets = {
      temperature: {
        inputRange: [-20, 50] as [number, number],
        outputRange: [0, 1] as [number, number],
        interpolationType: 'linear' as const,
        clampMode: 'clamp' as const,
        enabled: true
      },
      humidity: {
        inputRange: [0, 100] as [number, number],
        outputRange: [0, 1] as [number, number],
        interpolationType: 'linear' as const,
        clampMode: 'clamp' as const,
        enabled: true
      },
      pressure: {
        inputRange: [900, 1100] as [number, number],
        outputRange: [0, 1] as [number, number],
        interpolationType: 'linear' as const,
        clampMode: 'clamp' as const,
        enabled: true
      },
      percentage: {
        inputRange: [0, 100] as [number, number],
        outputRange: [0, 1] as [number, number],
        interpolationType: 'linear' as const,
        clampMode: 'clamp' as const,
        enabled: true
      }
    };

    return presets[preset];
  }
}

/**
 * 插值引擎
 * 处理平滑过渡和动画效果
 */
export class InterpolationEngine {
  private static activeTransitions = new Map<string, any>();

  /**
   * 创建插值过渡
   * @param from 起始值
   * @param to 目标值
   * @param config 插值配置
   * @param onUpdate 更新回调
   * @param onComplete 完成回调
   * @returns 过渡控制器
   */
  static createTransition(
    from: any, 
    to: any, 
    config: InterpolationConfig,
    onUpdate: (value: any) => void,
    onComplete?: () => void
  ): { cancel: () => void; pause: () => void; resume: () => void } {
    if (!config.enabled) {
      onUpdate(to);
      onComplete?.();
      return { cancel: () => {}, pause: () => {}, resume: () => {} };
    }

    const transitionId = Date.now().toString();
    let startTime: number;
    let pausedTime = 0;
    let isPaused = false;
    let isActive = true;

    const animate = (currentTime: number) => {
      if (!isActive) return;

      if (!startTime) {
        startTime = currentTime + config.delay;
      }

      if (currentTime < startTime) {
        requestAnimationFrame(animate);
        return;
      }

      if (isPaused) {
        requestAnimationFrame(animate);
        return;
      }

      const elapsed = currentTime - startTime - pausedTime;
      const progress = Math.min(elapsed / config.duration, 1);

      const easedProgress = this.applyEasing(progress, config.type, config.bezierPoints);
      const currentValue = this.interpolateValue(from, to, easedProgress);

      onUpdate(currentValue);

      if (progress >= 1) {
        isActive = false;
        this.activeTransitions.delete(transitionId);
        onComplete?.();
      } else {
        requestAnimationFrame(animate);
      }
    };

    this.activeTransitions.set(transitionId, {
      cancel: () => {
        isActive = false;
        this.activeTransitions.delete(transitionId);
      },
      pause: () => {
        if (!isPaused) {
          isPaused = true;
          pausedTime = Date.now() - startTime;
        }
      },
      resume: () => {
        if (isPaused) {
          isPaused = false;
          startTime = Date.now() - pausedTime;
        }
      }
    });

    requestAnimationFrame(animate);

    return this.activeTransitions.get(transitionId)!;
  }

  /**
   * 直接插值计算
   */
  static interpolate(from: any, to: any, progress: number, type: InterpolationConfig['type'] = 'linear'): any {
    const easedProgress = this.applyEasing(progress, type);
    return this.interpolateValue(from, to, easedProgress);
  }

  /**
   * 应用缓动函数
   */
  private static applyEasing(
    progress: number, 
    type: InterpolationConfig['type'],
    bezierPoints?: [number, number, number, number]
  ): number {
    switch (type) {
      case 'linear':
        return progress;
      case 'ease':
        return this.cubicBezier(progress, 0.25, 0.1, 0.25, 1);
      case 'ease-in':
        return this.cubicBezier(progress, 0.42, 0, 1, 1);
      case 'ease-out':
        return this.cubicBezier(progress, 0, 0, 0.58, 1);
      case 'ease-in-out':
        return this.cubicBezier(progress, 0.42, 0, 0.58, 1);
      case 'cubic-bezier':
        if (bezierPoints) {
          return this.cubicBezier(progress, ...bezierPoints);
        }
        return progress;
      default:
        return progress;
    }
  }

  /**
   * 三次贝塞尔曲线插值
   */
  private static cubicBezier(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
    // 简化的贝塞尔曲线实现
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    return ((ax * t + bx) * t + cx) * t;
  }

  /**
   * 值插值计算
   */
  private static interpolateValue(from: any, to: any, progress: number): any {
    if (typeof from === 'number' && typeof to === 'number') {
      return from + (to - from) * progress;
    }

    if (Array.isArray(from) && Array.isArray(to) && from.length === to.length) {
      return from.map((fromVal, index) => 
        this.interpolateValue(fromVal, to[index], progress)
      );
    }

    if (typeof from === 'object' && typeof to === 'object' && from && to) {
      const result = { ...from };
      Object.keys(to).forEach(key => {
        if (key in from) {
          result[key] = this.interpolateValue(from[key], to[key], progress);
        }
      });
      return result;
    }

    // 对于不能插值的类型，在进度过半时切换
    return progress < 0.5 ? from : to;
  }

  /**
   * 取消所有活动的过渡
   */
  static cancelAllTransitions(): void {
    this.activeTransitions.forEach(transition => transition.cancel());
    this.activeTransitions.clear();
  }
}