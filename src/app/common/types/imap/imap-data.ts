
/**
 * MessageSource can be a single message identifier, a message identifier range (e.g. '2504:2507' or '*' or '2504:*'),
 * an array of message identifiers, or an array of message identifier ranges.
 */
export type MessageSource = string | string[];
export type Criteria = (string | string[])[];
export type UID = number;
