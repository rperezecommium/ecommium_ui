import "server-only";
import Ajv from "ajv";
import schema from "../../../docs/contracts/cms-composition-boundary.schema.json";
const validators = Object.fromEntries(
  [
    "composition",
    "receipt",
    "pageCreate",
    "pageUpdate",
    "publishRequest",
    "pageChangePath",
    "pageUnpublish",
    "pageDelete",
  ].map((name) => [
    name,
    new Ajv({ allErrors: true }).compile({
      definitions: schema.definitions,
      $ref: `#/definitions/${name}`,
    }),
  ]),
);
export function validatePageContract(kind: string, value: unknown) {
  const json = JSON.stringify(value);
  if (
    !json ||
    new TextEncoder().encode(json).length > 1048576 ||
    !validators[kind]?.(value)
  )
    throw Error("La página no cumple el contrato de composición.");
}
