using System;

public class WAV
{
    public float[] LeftChannel { get; internal set; }
    public int SampleCount { get; internal set; }
    public int Frequency { get; internal set; }

    public WAV(byte[] wav)
    {
        Frequency = BitConverter.ToInt32(wav, 24);
        int pos = 12;
        while (!(wav[pos] == 'd' && wav[pos + 1] == 'a' && wav[pos + 2] == 't' && wav[pos + 3] == 'a'))
        {
            pos += 4;
            int chunkSize = BitConverter.ToInt32(wav, pos);
            pos += 4 + chunkSize;
        }
        pos += 4;
        int subchunk2Size = BitConverter.ToInt32(wav, pos);
        pos += 4;
        SampleCount = subchunk2Size / 2;
        LeftChannel = new float[SampleCount];
        for (int i = 0; i < SampleCount; i++)
        {
            LeftChannel[i] = bytesToFloat(wav[pos], wav[pos + 1]);
            pos += 2;
        }
    }

    static float bytesToFloat(byte firstByte, byte secondByte)
    {
        short s = (short)((secondByte << 8) | firstByte);
        return s / 32768.0f;
    }
}