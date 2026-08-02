/**
 * Decides whether the `temperature` sampling parameter may be sent to a model.
 *
 * Anthropic removed the sampling parameters (`temperature`, `top_p`, `top_k`)
 * starting with Opus 4.7 and for every model of generation 5 and above
 * (Opus 5, Sonnet 5, Fable 5, Mythos 5). Those models answer with
 * HTTP 400 ("Temperature is deprecated.") as soon as the field is present,
 * while older models (Sonnet 4.6, Haiku 4.5, Opus 4.6, Claude 3.x, ...) and all
 * OpenAI-compatible endpoints still expect it.
 *
 * Because the list of affected models keeps growing, the decision combines two
 * sources:
 * 1. A static rule derived from the Anthropic model naming scheme, so no extra
 *    round trip is needed for known models.
 * 2. A runtime fallback: whenever an endpoint rejects a request because of the
 *    temperature parameter, the model is remembered for the rest of the session
 *    and the parameter is omitted from then on.
 */
export default class TemperatureSupport {
    /** Models that answered with a temperature related error during this session. */
    private readonly rejectedModels = new Set<string>();

    /**
     * Matches Anthropic model ids such as `claude-opus-4-7`, `claude-sonnet-5`
     * or the platform prefixed `anthropic.claude-opus-5`. Dated Claude 3 ids
     * (`claude-3-opus-20240229`) intentionally do not match, because the family
     * and version parts are swapped there and those models still accept
     * temperature.
     */
    private static readonly ANTHROPIC_MODEL_ID =
        /claude-(?<family>[a-z]+)-(?<major>\d+)(?:-(?<minor>\d+))?/i;

    /**
     * Checks whether `temperature` should be part of the request body.
     * @param model - Configured model identifier.
     */
    public isSupported(model: string): boolean {
        if (this.rejectedModels.has(model)) {
            return false;
        }

        return TemperatureSupport.isSupportedByModelId(model);
    }

    /**
     * Remembers that a model rejected the temperature parameter so that
     * subsequent requests skip it right away.
     * @param model - Model identifier that produced the error.
     */
    public rememberRejection(model: string): void {
        this.rejectedModels.add(model);
    }

    /**
     * Detects whether an API error was caused by the temperature parameter.
     * Anthropic reports "Temperature is deprecated.", OpenAI style endpoints
     * report an unsupported value for 'temperature'; both use status 400.
     * @param status - HTTP status code of the failed response.
     * @param details - Raw error body returned by the API.
     */
    public static isTemperatureRejection(status: number, details: string): boolean {
        return status === 400 && /temperature/i.test(details);
    }

    /**
     * Applies the Anthropic naming scheme rule. Unknown identifiers (local
     * models, OpenAI, custom deployments) are treated as supporting temperature;
     * a wrong guess is corrected by the runtime fallback.
     * @param model - Model identifier to classify.
     */
    private static isSupportedByModelId(model: string): boolean {
        const match = TemperatureSupport.ANTHROPIC_MODEL_ID.exec(model.trim());
        if (!match?.groups) {
            return true;
        }

        const family = match.groups.family.toLowerCase();
        const major = Number(match.groups.major);
        const minor = Number(match.groups.minor ?? '0');

        // Generation 5 and newer dropped the sampling parameters completely.
        if (major >= 5) {
            return false;
        }

        // Within generation 4 only the Opus line lost them, starting with 4.7.
        return !(family === 'opus' && major === 4 && minor >= 7);
    }
}
