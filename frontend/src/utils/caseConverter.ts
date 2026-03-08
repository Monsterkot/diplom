/**
 * Utility functions for converting between camelCase and snake_case
 * 
 * Frontend uses camelCase convention, backend (FastAPI/Python) uses snake_case.
 * These helpers ensure proper data transformation when sending data to the backend.
 */

/**
 * Converts a camelCase string to snake_case
 * @example toSnakeCase('publishedYear') => 'published_year'
 * @example toSnakeCase('fileName') => 'file_name'
 * @example toSnakeCase('HTMLParser') => 'h_t_m_l_parser'
 */
export const toSnakeCase = (key: string): string => {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase()
}

/**
 * Converts an object with camelCase keys to snake_case keys
 * Performs shallow conversion (only top-level keys)
 * 
 * @example toSnakeCaseKeys({ publishedYear: 2020 }) => { published_year: 2020 }
 * @example toSnakeCaseKeys({ fileName: 'test.pdf', fileSize: 1024 }) => { file_name: 'test.pdf', file_size: 1024 }
 */
export const toSnakeCaseKeys = <T extends Record<string, unknown>>(obj: T): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      result[toSnakeCase(key)] = value
    }
  }
  
  return result
}

/**
 * Converts an object with camelCase keys to snake_case keys
 * Performs deep conversion (including nested objects and arrays)
 * 
 * @example toSnakeCaseKeysDeep({ userInfo: { firstName: 'John' } }) => { user_info: { first_name: 'John' } }
 */
export const toSnakeCaseKeysDeep = <T>(obj: T): T => {
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => toSnakeCaseKeysDeep(item)) as T
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnakeCase(key)
      result[snakeKey] = toSnakeCaseKeysDeep(value)
    }
    
    return result as T
  }
  
  return obj
}

/**
 * Converts a snake_case string to camelCase
 * @example toCamelCase('published_year') => 'publishedYear'
 * @example toCamelCase('file_name') => 'fileName'
 */
export const toCamelCase = (key: string): string => {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Converts an object with snake_case keys to camelCase keys
 * Performs shallow conversion (only top-level keys)
 */
export const toCamelCaseKeys = <T extends Record<string, unknown>>(obj: T): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCase(key)] = value
  }
  
  return result
}

/**
 * Converts an object with snake_case keys to camelCase keys
 * Performs deep conversion (including nested objects and arrays)
 */
export const toCamelCaseKeysDeep = <T>(obj: T): T => {
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCaseKeysDeep(item)) as T
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = toCamelCase(key)
      result[camelKey] = toCamelCaseKeysDeep(value)
    }
    
    return result as T
  }
  
  return obj
}
