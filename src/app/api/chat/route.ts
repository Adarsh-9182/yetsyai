import { NextResponse } from "next/server";

// The former nutrition companion is not a Yetsyai feature.
export async function POST() {
  return NextResponse.json({ error: "This endpoint has been retired." }, { status: 410 });
}
