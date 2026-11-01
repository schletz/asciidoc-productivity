/**
 * Decides whether the `temperature` parameter may be sent to a model.
 *
 * Anthropic models from Opus 4.7 on and every model of generation 5 and above answer with
 * HTTP 400 as soon as the field is present; older Claude models and OpenAI-compatible
 * endpoints still accept it. Two sources decide:
 * 1. A static rule on the Anthropic model naming scheme, so known models need no extra request.
 * 2. A runtime fallback: a model whose request was rejected because of the temperature is
 *    remembered by this instance and gets no temperature from then on.
 */
export default class TemperatureSupport {
    /** Models that rejected the temperature during the lifetime of this instance. */
    private readonly rejectedModels = new Set<string>();

    /**
     * Matches ids such as `claude-opus-4-7`, `claude-sonnet-5` or `anthropic.claude-opus-5`.
     * Dated Claude 3 ids (`claude-3-opus-20240229`) do not match, because family and version
     * are swapped there; those models accept the temperature.
     */
    private static readonly ANTHROPIC_MODEL_ID =
        /claude-(?<family>[a-z]+)-(?<major>\d+)(?:-(?<minor>\d+))?/i;

    /**
     * Checks whether the request body may contain `temperature`.
     * @param model - Configured model id.
     */
    public isSupported(model: string): boolean {
        if (this.rejectedModels.has(model)) {
            return false;
        }

        return TemperatureSupport.isSupportedByModelId(model);
    }

    /**
     * Remembers that a model rejected the temperature.
     * @param model - Model id of the failed request.
     */
    public rememberRejection(model: string): void {
        this.rejectedModels.add(model);
    }

    /**
     * Detects an error caused by the temperature. Anthropic answers "Temperature is
     * deprecated.", OpenAI-style endpoints report an unsupported value for 'temperature';
     * both with status 400.
     * @param status - HTTP status of the failed response.
     * @param details - Response body.
     */
    public static isTemperatureRejection(status: number, details: string): boolean {
        return status === 400 && /temperature/i.test(details);
    }

    /**
     * Applies the naming scheme rule. Ids that are not Anthropic ids count as supported;
     * a wrong guess is corrected by the runtime fallback.
     * @param model - Model id to classify.
     */
    private static isSupportedByModelId(model: string): boolean {
        const match = TemperatureSupport.ANTHROPIC_MODEL_ID.exec(model.trim());
        if (!match?.groups) {
            return true;
        }

        const family = match.groups.family.toLowerCase();
        const major = Number(match.groups.major);
        const minor = Number(match.groups.minor ?? '0');

        if (major >= 5) {
            return false;
        }

        // Within generation 4 only the Opus line dropped the parameter, from 4.7 on.
        return !(family === 'opus' && major === 4 && minor >= 7);
    }
}
