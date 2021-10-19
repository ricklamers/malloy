/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { Dialect, DialectFieldList } from "./dialect";

export class BigQueryDialect extends Dialect {
  name = "bigquery";
  defaultNumberType = "FLOAT64";

  quoteTableName(tableName: string): string {
    return `\`${tableName}\``;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT row_number() OVER() -1  group_set FROM UNNEST(GENERATE_ARRAY(0,${groupSetCount},1)))`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${fieldName} END)`;
  }
  // can array agg or any_value a struct...
  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    let tail = "";
    if (limit !== undefined) {
      tail += ` LIMIT ${limit}`;
    }
    const fields = fieldList
      .map((f) => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(", ");
    return `ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}) END IGNORE NULLS ${orderBy} ${tail})`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map((f) => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(", ");
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}))`;
  }

  sqlAnyValueLastTurtle(name: string, sqlName: string): string {
    return `ANY_VALUE(CASE WHEN group_set=0 THEN ${name}__0 END) as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = fieldList
      .map((f) => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(", ");
    const nullValues = fieldList
      .map((f) => `NULL as ${f.sqlOutputName}`)
      .join(", ");

    return `COALESCE(ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}) END), STRUCT(${nullValues}))`;
  }

  sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    needDistinctKey: boolean
  ): string {
    if (needDistinctKey) {
      return `UNNEST(ARRAY(( SELECT AS STRUCT GENERATE_UUID() as __distinct_key, * FROM UNNEST(${source})))) as ${alias}`;
    } else {
      return `UNNEST(${source}) as ${alias}`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    sqlDistinctKey = `CAST(${sqlDistinctKey} AS STRING)`;
    const upperPart = `cast(cast(concat('0x', substr(to_hex(md5(${sqlDistinctKey})), 1, 15)) as int64) as numeric) * 4294967296`;
    const lowerPart = `cast(cast(concat('0x', substr(to_hex(md5(${sqlDistinctKey})), 16, 8)) as int64) as numeric)`;
    // See the comment below on `sql_sum_distinct` for why we multiply by this decimal
    const precisionShiftMultiplier = "0.000000001";
    return `(${upperPart} + ${lowerPart}) * ${precisionShiftMultiplier}`;
  }

  sqlGenerateUUID(): string {
    return `GENERATE_UUID()`;
  }
}